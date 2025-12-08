import * as FileSystem from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { mangadexApi, Manga } from "./mangadex";

const getDownloadsDir = () => {
  const docDir = (FileSystem as any).documentDirectory || "";
  return docDir + "downloads/";
};

const DOWNLOADS_DIR = getDownloadsDir();
const DOWNLOADS_KEY = "@mangareader_downloads";
const MANGA_INFO_KEY = "@mangareader_manga_info";
const AUTO_DELETE_DAYS = 7;

export interface DownloadedChapter {
  chapterId: string;
  mangaId: string;
  mangaTitle: string;
  chapterNumber: string;
  pages: string[];
  downloadedAt: number;
  sizeInBytes: number;
  pageCount: number;
  totalSize: number;
}

export interface DownloadedMangaInfo {
  mangaId: string;
  title: string;
  description: string;
  status: string;
  year: number | null;
  type: "Manga" | "Manhwa" | "Manhua";
  tags: string[];
  author: string;
  coverUrl: string | null;
  localCoverPath: string | null;
  downloadedAt: number;
}

export interface DownloadProgress {
  chapterId: string;
  progress: number;
  status: "downloading" | "completed" | "failed" | "cancelled";
}

type ProgressCallback = (progress: DownloadProgress) => void;

class DownloadManager {
  private activeDownloads: Map<string, { cancelled: boolean }> = new Map();

  async init(): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(DOWNLOADS_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(DOWNLOADS_DIR, { intermediates: true });
    }
    await this.cleanupOldDownloads();
  }

  async getDownloadedChapters(): Promise<DownloadedChapter[]> {
    try {
      const data = await AsyncStorage.getItem(DOWNLOADS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  async isChapterDownloaded(chapterId: string): Promise<boolean> {
    const downloads = await this.getDownloadedChapters();
    return downloads.some((d) => d.chapterId === chapterId);
  }

  async getDownloadedChapter(chapterId: string): Promise<DownloadedChapter | null> {
    const downloads = await this.getDownloadedChapters();
    const chapter = downloads.find((d) => d.chapterId === chapterId);
    
    if (!chapter) return null;
    
    const chapterDir = DOWNLOADS_DIR + chapterId + "/";
    const dirInfo = await FileSystem.getInfoAsync(chapterDir);
    
    if (!dirInfo.exists) {
      return null;
    }
    
    const verifiedPages: string[] = [];
    for (let i = 0; i < chapter.pageCount; i++) {
      const filename = `page_${i.toString().padStart(3, "0")}.jpg`;
      const localPath = chapterDir + filename;
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      if (fileInfo.exists) {
        verifiedPages.push(localPath);
      }
    }
    
    if (verifiedPages.length === 0) {
      return null;
    }
    
    return {
      ...chapter,
      pages: verifiedPages,
    };
  }

  async getAllDownloads(): Promise<DownloadedChapter[]> {
    return this.getDownloadedChapters();
  }

  async getSavedMangaInfo(mangaId: string): Promise<DownloadedMangaInfo | null> {
    try {
      const data = await AsyncStorage.getItem(MANGA_INFO_KEY);
      const allMangaInfo: Record<string, DownloadedMangaInfo> = data ? JSON.parse(data) : {};
      return allMangaInfo[mangaId] || null;
    } catch {
      return null;
    }
  }

  async getAllSavedMangaInfo(): Promise<DownloadedMangaInfo[]> {
    try {
      const data = await AsyncStorage.getItem(MANGA_INFO_KEY);
      const allMangaInfo: Record<string, DownloadedMangaInfo> = data ? JSON.parse(data) : {};
      return Object.values(allMangaInfo);
    } catch {
      return [];
    }
  }

  async saveMangaInfo(manga: Manga): Promise<DownloadedMangaInfo | null> {
    try {
      const existingInfo = await this.getSavedMangaInfo(manga.id);
      if (existingInfo) {
        return existingInfo;
      }

      const mangaDir = DOWNLOADS_DIR + "manga_" + manga.id + "/";
      const dirInfo = await FileSystem.getInfoAsync(mangaDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(mangaDir, { intermediates: true });
      }

      let localCoverPath: string | null = null;
      
      if (manga.coverUrl) {
        try {
          const coverFilename = "cover.jpg";
          const coverPath = mangaDir + coverFilename;
          const downloadResult = await FileSystem.downloadAsync(manga.coverUrl, coverPath);
          if (downloadResult.status === 200) {
            localCoverPath = coverPath;
          }
        } catch (err) {
          console.error("Failed to download cover:", err);
        }
      }

      const mangaInfo: DownloadedMangaInfo = {
        mangaId: manga.id,
        title: manga.title,
        description: manga.description,
        status: manga.status,
        year: manga.year,
        type: manga.type,
        tags: manga.tags,
        author: manga.author,
        coverUrl: manga.coverUrl,
        localCoverPath,
        downloadedAt: Date.now(),
      };

      const data = await AsyncStorage.getItem(MANGA_INFO_KEY);
      const allMangaInfo: Record<string, DownloadedMangaInfo> = data ? JSON.parse(data) : {};
      allMangaInfo[manga.id] = mangaInfo;
      await AsyncStorage.setItem(MANGA_INFO_KEY, JSON.stringify(allMangaInfo));

      return mangaInfo;
    } catch (err) {
      console.error("Failed to save manga info:", err);
      return null;
    }
  }

  async deleteMangaInfo(mangaId: string): Promise<void> {
    try {
      const mangaDir = DOWNLOADS_DIR + "manga_" + mangaId + "/";
      const dirInfo = await FileSystem.getInfoAsync(mangaDir);
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(mangaDir, { idempotent: true });
      }

      const data = await AsyncStorage.getItem(MANGA_INFO_KEY);
      const allMangaInfo: Record<string, DownloadedMangaInfo> = data ? JSON.parse(data) : {};
      delete allMangaInfo[mangaId];
      await AsyncStorage.setItem(MANGA_INFO_KEY, JSON.stringify(allMangaInfo));
    } catch (err) {
      console.error("Failed to delete manga info:", err);
    }
  }

  async downloadChapter(
    chapterId: string,
    mangaId: string,
    mangaTitle: string,
    chapterNumber: string,
    dataSaver: boolean = false,
    onProgress?: ProgressCallback,
    manga?: Manga
  ): Promise<boolean> {
    try {
      const alreadyDownloaded = await this.isChapterDownloaded(chapterId);
      if (alreadyDownloaded) {
        onProgress?.({ chapterId, progress: 100, status: "completed" });
        return true;
      }

      this.activeDownloads.set(chapterId, { cancelled: false });

      if (manga) {
        await this.saveMangaInfo(manga);
      } else {
        const existingInfo = await this.getSavedMangaInfo(mangaId);
        if (!existingInfo) {
          try {
            const mangaDetails = await mangadexApi.getMangaDetails(mangaId);
            if (mangaDetails) {
              await this.saveMangaInfo(mangaDetails);
            }
          } catch (err) {
            console.error("Failed to fetch manga details for saving:", err);
          }
        }
      }

      const chapterDir = DOWNLOADS_DIR + chapterId + "/";
      const dirInfo = await FileSystem.getInfoAsync(chapterDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(chapterDir, { intermediates: true });
      }

      const chapterData = await mangadexApi.getChapterPages(chapterId, dataSaver);
      const pages = chapterData.pages;
      const downloadedPages: string[] = [];
      let totalSize = 0;

      for (let i = 0; i < pages.length; i++) {
        const downloadState = this.activeDownloads.get(chapterId);
        if (downloadState?.cancelled) {
          await this.cleanupPartialDownload(chapterId);
          onProgress?.({ chapterId, progress: 0, status: "cancelled" });
          return false;
        }

        const pageUrl = pages[i];
        const filename = `page_${i.toString().padStart(3, "0")}.jpg`;
        const localPath = chapterDir + filename;

        try {
          const downloadResult = await FileSystem.downloadAsync(pageUrl, localPath);
          
          if (downloadResult.status === 200) {
            downloadedPages.push(localPath);
            const fileInfo = await FileSystem.getInfoAsync(localPath);
            if (fileInfo.exists && "size" in fileInfo) {
              totalSize += fileInfo.size || 0;
            }
          }
        } catch (err) {
          console.error(`Failed to download page ${i}:`, err);
        }

        const progress = Math.round(((i + 1) / pages.length) * 100);
        onProgress?.({ chapterId, progress, status: "downloading" });
      }

      if (downloadedPages.length === 0) {
        await this.cleanupPartialDownload(chapterId);
        onProgress?.({ chapterId, progress: 0, status: "failed" });
        return false;
      }

      const downloadedChapter: DownloadedChapter = {
        chapterId,
        mangaId,
        mangaTitle,
        chapterNumber,
        pages: downloadedPages,
        downloadedAt: Date.now(),
        sizeInBytes: totalSize,
        pageCount: downloadedPages.length,
        totalSize: totalSize,
      };

      await this.saveDownload(downloadedChapter);
      this.activeDownloads.delete(chapterId);
      onProgress?.({ chapterId, progress: 100, status: "completed" });
      return true;
    } catch (error) {
      console.error("Download failed:", error);
      await this.cleanupPartialDownload(chapterId);
      this.activeDownloads.delete(chapterId);
      onProgress?.({ chapterId, progress: 0, status: "failed" });
      return false;
    }
  }

  cancelDownload(chapterId: string): void {
    const downloadState = this.activeDownloads.get(chapterId);
    if (downloadState) {
      downloadState.cancelled = true;
    }
  }

  private async saveDownload(chapter: DownloadedChapter): Promise<void> {
    const downloads = await this.getDownloadedChapters();
    downloads.push(chapter);
    await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(downloads));
  }

  async deleteDownload(chapterId: string): Promise<void> {
    const chapterDir = DOWNLOADS_DIR + chapterId + "/";
    
    try {
      const dirInfo = await FileSystem.getInfoAsync(chapterDir);
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(chapterDir, { idempotent: true });
      }
    } catch (err) {
      console.error("Failed to delete chapter files:", err);
    }

    const downloads = await this.getDownloadedChapters();
    const deletedChapter = downloads.find(d => d.chapterId === chapterId);
    const filtered = downloads.filter((d) => d.chapterId !== chapterId);
    await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(filtered));

    if (deletedChapter) {
      const remainingForManga = filtered.filter(d => d.mangaId === deletedChapter.mangaId);
      if (remainingForManga.length === 0) {
        await this.deleteMangaInfo(deletedChapter.mangaId);
      }
    }
  }

  async deleteAllDownloads(): Promise<void> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(DOWNLOADS_DIR);
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(DOWNLOADS_DIR, { idempotent: true });
        await FileSystem.makeDirectoryAsync(DOWNLOADS_DIR, { intermediates: true });
      }
    } catch (err) {
      console.error("Failed to delete all downloads:", err);
    }
    
    await AsyncStorage.removeItem(DOWNLOADS_KEY);
    await AsyncStorage.removeItem(MANGA_INFO_KEY);
  }

  async cleanupOldDownloads(): Promise<void> {
    const downloads = await this.getDownloadedChapters();
    const now = Date.now();
    const maxAge = AUTO_DELETE_DAYS * 24 * 60 * 60 * 1000;

    const toDelete = downloads.filter((d) => now - d.downloadedAt > maxAge);
    
    for (const chapter of toDelete) {
      await this.deleteDownload(chapter.chapterId);
    }
  }

  private async cleanupPartialDownload(chapterId: string): Promise<void> {
    const chapterDir = DOWNLOADS_DIR + chapterId + "/";
    try {
      const dirInfo = await FileSystem.getInfoAsync(chapterDir);
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(chapterDir, { idempotent: true });
      }
    } catch (err) {
      console.error("Failed to cleanup partial download:", err);
    }
    this.activeDownloads.delete(chapterId);
  }

  async getTotalDownloadSize(): Promise<number> {
    const downloads = await this.getDownloadedChapters();
    return downloads.reduce((total, d) => total + d.sizeInBytes, 0);
  }

  async getDownloadsByManga(mangaId: string): Promise<DownloadedChapter[]> {
    const downloads = await this.getDownloadedChapters();
    return downloads.filter((d) => d.mangaId === mangaId);
  }

  formatSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  async exportChapterToPdf(
    chapterId: string,
    onProgress?: (progress: number) => void
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      const chapter = await this.getDownloadedChapter(chapterId);
      if (!chapter) {
        return { success: false, error: "Chapter not found" };
      }

      onProgress?.(10);

      const imageDataPromises = chapter.pages.map(async (pagePath, index) => {
        try {
          const base64 = await FileSystem.readAsStringAsync(pagePath, {
            encoding: FileSystem.EncodingType.Base64,
          });
          return { index, base64, success: true };
        } catch (err) {
          console.error(`Failed to read page ${index}:`, err);
          return { index, base64: "", success: false };
        }
      });

      const imageResults = await Promise.all(imageDataPromises);
      const validImages = imageResults
        .filter(r => r.success)
        .sort((a, b) => a.index - b.index);

      if (validImages.length === 0) {
        return { success: false, error: "No valid images found" };
      }

      onProgress?.(40);

      const safeTitle = chapter.mangaTitle.replace(/[^a-zA-Z0-9\s]/g, "").substring(0, 50);
      const fileName = `${safeTitle} - Chapter ${chapter.chapterNumber}.pdf`;

      const imagesHtml = validImages
        .map(
          (img) => `
          <div style="page-break-after: always; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; padding: 0;">
            <img src="data:image/jpeg;base64,${img.base64}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
          </div>
        `
        )
        .join("");

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>${chapter.mangaTitle} - Chapter ${chapter.chapterNumber}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { background: #000; }
              @page { margin: 0; size: auto; }
            </style>
          </head>
          <body>
            ${imagesHtml}
          </body>
        </html>
      `;

      onProgress?.(60);

      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });

      onProgress?.(80);

      const cacheDir = (FileSystem as any).cacheDirectory || "";
      const pdfCacheDir = cacheDir + "temp_pdfs/";
      const pdfDirInfo = await FileSystem.getInfoAsync(pdfCacheDir);
      if (!pdfDirInfo.exists) {
        await FileSystem.makeDirectoryAsync(pdfCacheDir, { intermediates: true });
      }

      const finalPath = pdfCacheDir + fileName;
      await FileSystem.moveAsync({ from: uri, to: finalPath });

      onProgress?.(100);

      return { success: true, filePath: finalPath };
    } catch (error) {
      console.error("PDF export failed:", error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to export PDF" 
      };
    }
  }

  async sharePdf(filePath: string): Promise<boolean> {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        console.error("Sharing is not available on this device");
        return false;
      }

      await Sharing.shareAsync(filePath, {
        mimeType: "application/pdf",
        dialogTitle: "Share Chapter PDF",
      });

      return true;
    } catch (error) {
      console.error("Failed to share PDF:", error);
      return false;
    }
  }

  async openPdf(filePath: string): Promise<boolean> {
    try {
      if (Platform.OS === "android") {
        const IntentLauncher = require("expo-intent-launcher");
        const contentUri = await FileSystem.getContentUriAsync(filePath);
        await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
          data: contentUri,
          flags: 1,
          type: "application/pdf",
        });
        setTimeout(() => this.cleanupTempPdf(filePath), 60000);
        return true;
      } else if (Platform.OS === "ios") {
        const isAvailable = await Sharing.isAvailableAsync();
        if (!isAvailable) {
          console.error("Sharing is not available on this device");
          return false;
        }
        await Sharing.shareAsync(filePath, {
          mimeType: "application/pdf",
          UTI: "com.adobe.pdf",
        });
        setTimeout(() => this.cleanupTempPdf(filePath), 60000);
        return true;
      } else if (Platform.OS === "web") {
        console.warn("PDF opening is not supported on web. Use native app.");
        return false;
      }
      return false;
    } catch (error) {
      console.error("Failed to open PDF:", error);
      return false;
    }
  }

  private async cleanupTempPdf(filePath: string): Promise<void> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(filePath, { idempotent: true });
        console.log("Cleaned up temp PDF:", filePath);
      }
    } catch (error) {
      console.warn("Failed to cleanup temp PDF:", error);
    }
  }

  async cleanupAllTempPdfs(): Promise<void> {
    try {
      const cacheDir = (FileSystem as any).cacheDirectory || "";
      const tempPdfDir = cacheDir + "temp_pdfs/";
      const dirInfo = await FileSystem.getInfoAsync(tempPdfDir);
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(tempPdfDir, { idempotent: true });
        console.log("Cleaned up all temp PDFs");
      }
    } catch (error) {
      console.warn("Failed to cleanup temp PDFs:", error);
    }
  }

  async exportAndShareChapter(
    chapterId: string,
    onProgress?: (progress: number) => void
  ): Promise<{ success: boolean; error?: string }> {
    const result = await this.exportChapterToPdf(chapterId, onProgress);
    
    if (!result.success || !result.filePath) {
      return { success: false, error: result.error || "Export failed" };
    }

    const shared = await this.sharePdf(result.filePath);
    if (!shared) {
      return { success: false, error: "Failed to share PDF" };
    }

    return { success: true };
  }

  async getExportedPdfs(): Promise<string[]> {
    try {
      const pdfDir = DOWNLOADS_DIR + "pdfs/";
      const dirInfo = await FileSystem.getInfoAsync(pdfDir);
      if (!dirInfo.exists) {
        return [];
      }

      const files = await FileSystem.readDirectoryAsync(pdfDir);
      return files.filter(f => f.endsWith(".pdf")).map(f => pdfDir + f);
    } catch {
      return [];
    }
  }

  async deletePdf(filePath: string): Promise<void> {
    try {
      await FileSystem.deleteAsync(filePath, { idempotent: true });
    } catch (err) {
      console.error("Failed to delete PDF:", err);
    }
  }

  async deleteAllPdfs(): Promise<void> {
    try {
      const pdfDir = DOWNLOADS_DIR + "pdfs/";
      const dirInfo = await FileSystem.getInfoAsync(pdfDir);
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(pdfDir, { idempotent: true });
      }
    } catch (err) {
      console.error("Failed to delete all PDFs:", err);
    }
  }
}

export const downloadManager = new DownloadManager();
