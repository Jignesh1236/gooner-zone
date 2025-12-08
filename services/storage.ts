import AsyncStorage from "@react-native-async-storage/async-storage";
import { Manga } from "./mangadex";

const KEYS = {
  BOOKMARKS: "@mangareader_bookmarks",
  READING_HISTORY: "@mangareader_history",
  READING_PROGRESS: "@mangareader_progress",
  RECENT_SEARCHES: "@mangareader_searches",
  SETTINGS: "@mangareader_settings",
};

export interface BookmarkedManga extends Manga {
  bookmarkedAt: number;
}

export interface ReadingHistoryItem {
  manga: Manga;
  lastReadAt: number;
  lastChapterId: string;
  lastChapterNumber: string;
}

export interface ReadingProgress {
  mangaId: string;
  chapterId: string;
  chapterNumber: string;
  page: number;
  totalPages: number;
  updatedAt: number;
}

export interface AppSettings {
  readingMode: "vertical" | "horizontal";
  readerType: "standard" | "lite" | "html";
  theme: "light" | "dark" | "auto";
  dataSaver: boolean;
  chapterLanguages: string[];
  adultMode: boolean;
  volumeScrollEnabled: boolean;
  volumeScrollSensitivity: number;
}

const defaultSettings: AppSettings = {
  readingMode: "vertical",
  readerType: "lite",
  theme: "auto",
  dataSaver: true,
  chapterLanguages: ["en", "ja"],
  adultMode: false,
  volumeScrollEnabled: true,
  volumeScrollSensitivity: 50,
};

export const storage = {
  async getBookmarks(): Promise<BookmarkedManga[]> {
    try {
      const data = await AsyncStorage.getItem(KEYS.BOOKMARKS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async addBookmark(manga: Manga): Promise<void> {
    const bookmarks = await this.getBookmarks();
    const exists = bookmarks.some((b) => b.id === manga.id);

    if (!exists) {
      const bookmarkedManga: BookmarkedManga = {
        ...manga,
        bookmarkedAt: Date.now(),
      };
      bookmarks.unshift(bookmarkedManga);
      await AsyncStorage.setItem(KEYS.BOOKMARKS, JSON.stringify(bookmarks));
    }
  },

  async removeBookmark(mangaId: string): Promise<void> {
    const bookmarks = await this.getBookmarks();
    const filtered = bookmarks.filter((b) => b.id !== mangaId);
    await AsyncStorage.setItem(KEYS.BOOKMARKS, JSON.stringify(filtered));
  },

  async isBookmarked(mangaId: string): Promise<boolean> {
    const bookmarks = await this.getBookmarks();
    return bookmarks.some((b) => b.id === mangaId);
  },

  async getReadingHistory(): Promise<ReadingHistoryItem[]> {
    try {
      const data = await AsyncStorage.getItem(KEYS.READING_HISTORY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async addToHistory(
    manga: Manga,
    chapterId: string,
    chapterNumber: string,
  ): Promise<void> {
    let history = await this.getReadingHistory();

    history = history.filter((h) => h.manga.id !== manga.id);

    const historyItem: ReadingHistoryItem = {
      manga,
      lastReadAt: Date.now(),
      lastChapterId: chapterId,
      lastChapterNumber: chapterNumber,
    };

    history.unshift(historyItem);

    if (history.length > 50) {
      history = history.slice(0, 50);
    }

    await AsyncStorage.setItem(KEYS.READING_HISTORY, JSON.stringify(history));
  },

  async clearHistory(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.READING_HISTORY);
  },

  async getReadingProgress(mangaId: string): Promise<ReadingProgress | null> {
    try {
      const data = await AsyncStorage.getItem(KEYS.READING_PROGRESS);
      const allProgress: Record<string, ReadingProgress> = data
        ? JSON.parse(data)
        : {};
      return allProgress[mangaId] || null;
    } catch {
      return null;
    }
  },

  async saveReadingProgress(progress: ReadingProgress): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(KEYS.READING_PROGRESS);
      const allProgress: Record<string, ReadingProgress> = data
        ? JSON.parse(data)
        : {};

      allProgress[progress.mangaId] = {
        ...progress,
        updatedAt: Date.now(),
      };

      await AsyncStorage.setItem(
        KEYS.READING_PROGRESS,
        JSON.stringify(allProgress),
      );
    } catch (error) {
      console.error("Failed to save reading progress:", error);
    }
  },

  async getReadChapters(mangaId: string): Promise<string[]> {
    try {
      const key = `@mangareader_read_${mangaId}`;
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async markChapterAsRead(mangaId: string, chapterId: string): Promise<void> {
    const key = `@mangareader_read_${mangaId}`;
    const readChapters = await this.getReadChapters(mangaId);

    if (!readChapters.includes(chapterId)) {
      readChapters.push(chapterId);
      await AsyncStorage.setItem(key, JSON.stringify(readChapters));
    }
  },

  async getRecentSearches(): Promise<string[]> {
    try {
      const data = await AsyncStorage.getItem(KEYS.RECENT_SEARCHES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async addRecentSearch(query: string): Promise<void> {
    let searches = await this.getRecentSearches();
    searches = searches.filter((s) => s.toLowerCase() !== query.toLowerCase());
    searches.unshift(query);

    if (searches.length > 10) {
      searches = searches.slice(0, 10);
    }

    await AsyncStorage.setItem(KEYS.RECENT_SEARCHES, JSON.stringify(searches));
  },

  async clearRecentSearches(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.RECENT_SEARCHES);
  },

  async getSettings(): Promise<AppSettings> {
    try {
      const data = await AsyncStorage.getItem(KEYS.SETTINGS);
      return data ? { ...defaultSettings, ...JSON.parse(data) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  },

  async saveSettings(settings: Partial<AppSettings>): Promise<void> {
    const current = await this.getSettings();
    const updated = { ...current, ...settings };
    await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(updated));
  },

  async getLastRead(): Promise<ReadingHistoryItem | null> {
    const history = await this.getReadingHistory();
    return history.length > 0 ? history[0] : null;
  },
};
