import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  FlatList,
  Alert,
  ActivityIndicator,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useHeaderHeight } from "@react-navigation/elements";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import {
  storage,
  BookmarkedManga,
  ReadingHistoryItem,
} from "@/services/storage";
import { downloadManager, DownloadedChapter } from "@/services/downloadManager";
import { LibraryStackParamList } from "@/navigation/LibraryStackNavigator";

type LibraryScreenProps = {
  navigation: NativeStackNavigationProp<LibraryStackParamList, "Library">;
};

type TabType = "bookmarks" | "history" | "downloads";

interface GroupedDownloads {
  mangaId: string;
  mangaTitle: string;
  chapters: DownloadedChapter[];
  totalSize: number;
}

export default function LibraryScreen({ navigation }: LibraryScreenProps) {
  const { theme } = useTheme();
  const tabBarHeight = useBottomTabBarHeight();
  const headerHeight = useHeaderHeight();

  const [activeTab, setActiveTab] = useState<TabType>("bookmarks");
  const [bookmarks, setBookmarks] = useState<BookmarkedManga[]>([]);
  const [history, setHistory] = useState<ReadingHistoryItem[]>([]);
  const [downloads, setDownloads] = useState<GroupedDownloads[]>([]);
  const [totalDownloadSize, setTotalDownloadSize] = useState(0);
  const [exportingChapterId, setExportingChapterId] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState(0);

  const loadData = useCallback(async () => {
    const [bookmarksData, historyData, allDownloads] = await Promise.all([
      storage.getBookmarks(),
      storage.getReadingHistory(),
      downloadManager.getAllDownloads(),
    ]);
    setBookmarks(bookmarksData);
    setHistory(historyData);
    
    const grouped = allDownloads.reduce<GroupedDownloads[]>((acc, chapter) => {
      const existing = acc.find((g: GroupedDownloads) => g.mangaId === chapter.mangaId);
      if (existing) {
        existing.chapters.push(chapter);
        existing.totalSize += chapter.totalSize;
      } else {
        acc.push({
          mangaId: chapter.mangaId,
          mangaTitle: chapter.mangaTitle,
          chapters: [chapter],
          totalSize: chapter.totalSize,
        });
      }
      return acc;
    }, []);
    
    grouped.forEach((g: GroupedDownloads) => g.chapters.sort((a: DownloadedChapter, b: DownloadedChapter) => 
      parseFloat(a.chapterNumber) - parseFloat(b.chapterNumber)
    ));
    
    setDownloads(grouped);
    setTotalDownloadSize(allDownloads.reduce((sum: number, c: DownloadedChapter) => sum + c.totalSize, 0));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const handleRemoveBookmark = async (mangaId: string) => {
    Alert.alert(
      "Remove Bookmark",
      "Are you sure you want to remove this manga from your bookmarks?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await storage.removeBookmark(mangaId);
            loadData();
          },
        },
      ],
    );
  };

  const handleClearHistory = () => {
    Alert.alert(
      "Clear History",
      "Are you sure you want to clear your reading history?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            await storage.clearHistory();
            loadData();
          },
        },
      ],
    );
  };

  const handleDeleteChapter = async (chapterId: string) => {
    Alert.alert(
      "Delete Download",
      "Are you sure you want to delete this downloaded chapter?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await downloadManager.deleteDownload(chapterId);
            loadData();
          },
        },
      ],
    );
  };

  const handleDeleteMangaDownloads = async (mangaId: string, mangaTitle: string) => {
    Alert.alert(
      "Delete All Downloads",
      `Delete all downloaded chapters for "${mangaTitle}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete All",
          style: "destructive",
          onPress: async () => {
            const mangaDownloads = downloads.find(d => d.mangaId === mangaId);
            if (mangaDownloads) {
              for (const chapter of mangaDownloads.chapters) {
                await downloadManager.deleteDownload(chapter.chapterId);
              }
              loadData();
            }
          },
        },
      ],
    );
  };

  const handleOpenDownloadedChapter = (chapter: DownloadedChapter) => {
    navigation.navigate("LiteChapterReader" as any, {
      chapterId: chapter.chapterId,
      mangaId: chapter.mangaId,
      mangaTitle: chapter.mangaTitle,
      chapterNumber: chapter.chapterNumber,
    });
  };

  const handleOpenWithHtmlReader = (chapter: DownloadedChapter) => {
    navigation.navigate("HtmlChapterReader" as any, {
      chapterId: chapter.chapterId,
      mangaId: chapter.mangaId,
      mangaTitle: chapter.mangaTitle,
      chapterNumber: chapter.chapterNumber,
    });
  };

  const handleClearAllDownloads = () => {
    Alert.alert(
      "Clear All Downloads",
      `This will delete all ${formatSize(totalDownloadSize)} of downloaded content. Are you sure?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete All",
          style: "destructive",
          onPress: async () => {
            for (const manga of downloads) {
              for (const chapter of manga.chapters) {
                await downloadManager.deleteDownload(chapter.chapterId);
              }
            }
            loadData();
          },
        },
      ],
    );
  };

  const handleExportToPdf = async (chapter: DownloadedChapter) => {
    if (exportingChapterId) return;
    
    setExportingChapterId(chapter.chapterId);
    setExportProgress(0);

    try {
      const result = await downloadManager.exportChapterToPdf(
        chapter.chapterId,
        (progress) => setExportProgress(progress)
      );

      if (!result.success) {
        Alert.alert(
          "Export Failed",
          result.error || "Failed to export chapter to PDF"
        );
        return;
      }

      if (result.filePath) {
        const opened = await downloadManager.openPdf(result.filePath);
        if (!opened) {
          Alert.alert(
            "Open Failed",
            "Could not open the PDF. Please make sure you have a PDF viewer installed."
          );
        }
      }
    } catch (error) {
      Alert.alert(
        "Export Failed",
        "An unexpected error occurred while exporting"
      );
    } finally {
      setExportingChapterId(null);
      setExportProgress(0);
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleMangaPress = (mangaId: string) => {
    navigation.navigate("MangaDetail", { mangaId });
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const renderBookmarkItem = ({ item }: { item: BookmarkedManga }) => (
    <Pressable
      onPress={() => handleMangaPress(item.id)}
      onLongPress={() => handleRemoveBookmark(item.id)}
      style={({ pressed }) => [
        styles.listItem,
        {
          backgroundColor: theme.backgroundDefault,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      {item.coverUrl ? (
        <Image
          source={{ uri: item.coverUrl }}
          style={styles.thumbnail}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View
          style={[
            styles.thumbnail,
            styles.placeholderThumb,
            { backgroundColor: theme.backgroundSecondary },
          ]}
        >
          <Feather name="book" size={24} color={theme.textSecondary} />
        </View>
      )}
      <View style={styles.itemContent}>
        <ThemedText type="body" style={styles.itemTitle} numberOfLines={2}>
          {item.title}
        </ThemedText>
        <ThemedText
          type="caption"
          style={[styles.itemMeta, { color: theme.textSecondary }]}
        >
          Added {formatDate(item.bookmarkedAt)}
        </ThemedText>
      </View>
      <Feather name="chevron-right" size={20} color={theme.textSecondary} />
    </Pressable>
  );

  const renderDownloadItem = ({ item }: { item: GroupedDownloads }) => (
    <View style={[styles.downloadGroup, { backgroundColor: theme.backgroundDefault }]}>
      <Pressable
        onPress={() => handleMangaPress(item.mangaId)}
        onLongPress={() => handleDeleteMangaDownloads(item.mangaId, item.mangaTitle)}
        style={styles.downloadHeader}
      >
        <View style={styles.downloadHeaderInfo}>
          <ThemedText type="body" style={styles.itemTitle} numberOfLines={2}>
            {item.mangaTitle}
          </ThemedText>
          <ThemedText
            type="caption"
            style={{ color: theme.textSecondary }}
          >
            {item.chapters.length} chapter{item.chapters.length !== 1 ? "s" : ""} - {formatSize(item.totalSize)}
          </ThemedText>
        </View>
        <Pressable
          onPress={() => handleDeleteMangaDownloads(item.mangaId, item.mangaTitle)}
          style={({ pressed }) => [
            styles.deleteBtn,
            { opacity: pressed ? 0.6 : 1 },
          ]}
          hitSlop={8}
        >
          <Feather name="trash-2" size={18} color={theme.textSecondary} />
        </Pressable>
      </Pressable>
      <View style={styles.chaptersList}>
        {item.chapters.map((chapter) => {
          const isExporting = exportingChapterId === chapter.chapterId;
          return (
            <View
              key={chapter.chapterId}
              style={[styles.chapterRow, { borderColor: theme.backgroundSecondary }]}
            >
              <Pressable
                onPress={() => handleOpenDownloadedChapter(chapter)}
                onLongPress={() => handleDeleteChapter(chapter.chapterId)}
                style={({ pressed }) => [
                  styles.chapterRowInfo,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <ThemedText type="small">
                  Chapter {chapter.chapterNumber}
                </ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  {formatSize(chapter.totalSize)} - {chapter.pageCount} pages
                </ThemedText>
              </Pressable>
              <View style={styles.chapterActions}>
                <Pressable
                  onPress={() => handleExportToPdf(chapter)}
                  disabled={exportingChapterId !== null}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    { opacity: (pressed || (exportingChapterId !== null && !isExporting)) ? 0.5 : 1 },
                  ]}
                  hitSlop={8}
                >
                  {isExporting ? (
                    <View style={styles.exportingContainer}>
                      <ActivityIndicator size="small" color={theme.accent} />
                      <ThemedText type="caption" style={{ color: theme.accent, marginLeft: 4 }}>
                        {exportProgress}%
                      </ThemedText>
                    </View>
                  ) : (
                    <Feather name="file-text" size={18} color={theme.accent} />
                  )}
                </Pressable>
                <Pressable
                  onPress={() => handleOpenWithHtmlReader(chapter)}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                  hitSlop={8}
                >
                  <Feather name="globe" size={18} color="#FF9500" />
                </Pressable>
                <Pressable
                  onPress={() => handleOpenDownloadedChapter(chapter)}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                  hitSlop={8}
                >
                  <Feather name="play-circle" size={20} color={theme.primary} />
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );

  const renderHistoryItem = ({ item }: { item: ReadingHistoryItem }) => (
    <Pressable
      onPress={() => handleMangaPress(item.manga.id)}
      style={({ pressed }) => [
        styles.listItem,
        {
          backgroundColor: theme.backgroundDefault,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      {item.manga.coverUrl ? (
        <Image
          source={{ uri: item.manga.coverUrl }}
          style={styles.thumbnail}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View
          style={[
            styles.thumbnail,
            styles.placeholderThumb,
            { backgroundColor: theme.backgroundSecondary },
          ]}
        >
          <Feather name="book" size={24} color={theme.textSecondary} />
        </View>
      )}
      <View style={styles.itemContent}>
        <ThemedText type="body" style={styles.itemTitle} numberOfLines={2}>
          {item.manga.title}
        </ThemedText>
        <ThemedText
          type="caption"
          style={[styles.itemMeta, { color: theme.textSecondary }]}
        >
          Chapter {item.lastChapterNumber} - {formatDate(item.lastReadAt)}
        </ThemedText>
      </View>
      <Feather name="chevron-right" size={20} color={theme.textSecondary} />
    </Pressable>
  );

  const getCurrentData = () => {
    switch (activeTab) {
      case "bookmarks": return bookmarks;
      case "history": return history;
      case "downloads": return downloads;
    }
  };
  
  const currentData = getCurrentData();
  const isEmpty = currentData.length === 0;

  const getEmptyState = () => {
    switch (activeTab) {
      case "bookmarks":
        return { icon: "bookmark" as const, title: "No Bookmarks", message: "Manga you bookmark will appear here" };
      case "history":
        return { icon: "clock" as const, title: "No Reading History", message: "Your reading history will appear here" };
      case "downloads":
        return { icon: "download" as const, title: "No Downloads", message: "Downloaded chapters will appear here for offline reading" };
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View
        style={[
          styles.tabContainer,
          {
            paddingTop: headerHeight + Spacing.md,
            backgroundColor: theme.backgroundRoot,
          },
        ]}
      >
        <View
          style={[
            styles.tabBar,
            { backgroundColor: theme.backgroundDefault },
          ]}
        >
          <Pressable
            onPress={() => setActiveTab("bookmarks")}
            style={[
              styles.tab,
              activeTab === "bookmarks" && {
                backgroundColor: theme.primary,
              },
            ]}
          >
            <ThemedText
              type="small"
              style={[
                styles.tabText,
                {
                  color:
                    activeTab === "bookmarks"
                      ? "#FFFFFF"
                      : theme.textSecondary,
                },
              ]}
            >
              Bookmarks
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab("history")}
            style={[
              styles.tab,
              activeTab === "history" && {
                backgroundColor: theme.primary,
              },
            ]}
          >
            <ThemedText
              type="small"
              style={[
                styles.tabText,
                {
                  color:
                    activeTab === "history" ? "#FFFFFF" : theme.textSecondary,
                },
              ]}
            >
              History
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab("downloads")}
            style={[
              styles.tab,
              activeTab === "downloads" && {
                backgroundColor: theme.primary,
              },
            ]}
          >
            <ThemedText
              type="small"
              style={[
                styles.tabText,
                {
                  color:
                    activeTab === "downloads" ? "#FFFFFF" : theme.textSecondary,
                },
              ]}
            >
              Downloads
            </ThemedText>
          </Pressable>
        </View>
        {activeTab === "history" && history.length > 0 ? (
          <Pressable
            onPress={handleClearHistory}
            style={({ pressed }) => [
              styles.clearButton,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Feather name="trash-2" size={18} color={theme.textSecondary} />
          </Pressable>
        ) : activeTab === "downloads" && downloads.length > 0 ? (
          <Pressable
            onPress={handleClearAllDownloads}
            style={({ pressed }) => [
              styles.clearButton,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Feather name="trash-2" size={18} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      {activeTab === "downloads" && downloads.length > 0 && (
        <View style={[styles.downloadStats, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Total: {formatSize(totalDownloadSize)} - {downloads.reduce((sum, d) => sum + d.chapters.length, 0)} chapters
          </ThemedText>
        </View>
      )}

      {isEmpty ? (
        <EmptyState {...getEmptyState()} />
      ) : (
        <FlatList
          data={currentData as any}
          renderItem={
            activeTab === "bookmarks" 
              ? renderBookmarkItem as any 
              : activeTab === "history" 
                ? renderHistoryItem as any 
                : renderDownloadItem as any
          }
          keyExtractor={(item) =>
            activeTab === "bookmarks"
              ? (item as BookmarkedManga).id
              : activeTab === "history"
                ? (item as ReadingHistoryItem).manga.id
                : (item as GroupedDownloads).mangaId
          }
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: tabBarHeight + Spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabContainer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  tabBar: {
    flex: 1,
    flexDirection: "row",
    borderRadius: BorderRadius.xs,
    padding: Spacing.xs,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xs - 2,
    alignItems: "center",
  },
  tabText: {
    fontWeight: "600",
  },
  clearButton: {
    padding: Spacing.sm,
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  thumbnail: {
    width: 60,
    height: 80,
    borderRadius: BorderRadius.xs - 2,
  },
  placeholderThumb: {
    alignItems: "center",
    justifyContent: "center",
  },
  itemContent: {
    flex: 1,
    gap: Spacing.xs,
  },
  itemTitle: {
    fontWeight: "600",
  },
  itemMeta: {},
  downloadStats: {
    marginHorizontal: Spacing.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xs,
    marginBottom: Spacing.sm,
  },
  downloadGroup: {
    borderRadius: BorderRadius.xs,
    marginBottom: Spacing.md,
    overflow: "hidden",
  },
  downloadHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    gap: Spacing.md,
  },
  downloadHeaderInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  deleteBtn: {
    padding: Spacing.sm,
  },
  chaptersList: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  chapterRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
  },
  chapterRowInfo: {
    flex: 1,
    gap: 2,
  },
  deleteChapterBtn: {
    padding: Spacing.xs,
  },
  chapterActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  actionBtn: {
    padding: Spacing.xs,
  },
  exportingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
});
