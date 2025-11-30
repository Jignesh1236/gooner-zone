import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  FlatList,
  Alert,
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
import { LibraryStackParamList } from "@/navigation/LibraryStackNavigator";

type LibraryScreenProps = {
  navigation: NativeStackNavigationProp<LibraryStackParamList, "Library">;
};

type TabType = "bookmarks" | "history";

export default function LibraryScreen({ navigation }: LibraryScreenProps) {
  const { theme } = useTheme();
  const tabBarHeight = useBottomTabBarHeight();
  const headerHeight = useHeaderHeight();

  const [activeTab, setActiveTab] = useState<TabType>("bookmarks");
  const [bookmarks, setBookmarks] = useState<BookmarkedManga[]>([]);
  const [history, setHistory] = useState<ReadingHistoryItem[]>([]);

  const loadData = useCallback(async () => {
    const [bookmarksData, historyData] = await Promise.all([
      storage.getBookmarks(),
      storage.getReadingHistory(),
    ]);
    setBookmarks(bookmarksData);
    setHistory(historyData);
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

  const currentData = activeTab === "bookmarks" ? bookmarks : history;
  const isEmpty = currentData.length === 0;

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
        ) : null}
      </View>

      {isEmpty ? (
        <EmptyState
          icon={activeTab === "bookmarks" ? "bookmark" : "clock"}
          title={
            activeTab === "bookmarks" ? "No Bookmarks" : "No Reading History"
          }
          message={
            activeTab === "bookmarks"
              ? "Manga you bookmark will appear here"
              : "Your reading history will appear here"
          }
        />
      ) : (
        <FlatList
          data={currentData}
          renderItem={
            activeTab === "bookmarks" ? renderBookmarkItem : renderHistoryItem
          }
          keyExtractor={(item) =>
            activeTab === "bookmarks"
              ? (item as BookmarkedManga).id
              : (item as ReadingHistoryItem).manga.id
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
});
