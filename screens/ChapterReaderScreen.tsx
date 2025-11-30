import React, { useEffect, useState, useCallback, useRef, memo } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Dimensions,
  FlatList,
  Platform,
} from "react-native";
import * as Haptics from "expo-haptics";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { mangadexApi } from "@/services/mangadex";
import { storage } from "@/services/storage";
import { BrowseStackParamList } from "@/navigation/BrowseStackNavigator";

type ChapterReaderScreenProps = {
  navigation: NativeStackNavigationProp<BrowseStackParamList, "ChapterReader">;
  route: RouteProp<BrowseStackParamList, "ChapterReader">;
};

const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;

interface PageItemProps {
  uri: string;
  index: number;
  onPress: () => void;
}

const PageItem = memo(({ uri, index, onPress }: PageItemProps) => {
  const [aspectRatio, setAspectRatio] = useState(0.7);

  return (
    <Pressable onPress={onPress} style={styles.pageContainer}>
      <View style={{ width: SCREEN_WIDTH, aspectRatio }}>
        <Image
          source={{ uri }}
          style={styles.pageImage}
          contentFit="contain"
          cachePolicy="memory-disk"
          recyclingKey={uri}
          onLoad={(e) => {
            const { width, height } = e.source;
            if (width && height) {
              setAspectRatio(width / height);
            }
          }}
        />
      </View>
    </Pressable>
  );
});

export default function ChapterReaderScreen({
  navigation,
  route,
}: ChapterReaderScreenProps) {
  const { chapterId, mangaId, mangaTitle } = route.params;
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [pages, setPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [showUI, setShowUI] = useState(false);
  const [chapterNumber, setChapterNumber] = useState<string>("0");

  const uiOpacity = useSharedValue(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const animatedHeaderStyle = useAnimatedStyle(() => ({
    opacity: uiOpacity.value,
    transform: [{ translateY: (1 - uiOpacity.value) * -60 }],
  }));

  const animatedFooterStyle = useAnimatedStyle(() => ({
    opacity: uiOpacity.value,
    transform: [{ translateY: (1 - uiOpacity.value) * 60 }],
  }));

  const fetchChapterPages = useCallback(async () => {
    try {
      setLoading(true);

      const pageData = await mangadexApi.getChapterPages(chapterId);
      setPages(pageData.pages);

      const savedProgress = await storage.getReadingProgress(mangaId);
      if (savedProgress && savedProgress.chapterId === chapterId) {
        setCurrentPage(savedProgress.page);
        setChapterNumber(savedProgress.chapterNumber);
      }

      await storage.markChapterAsRead(mangaId, chapterId);
    } catch (err) {
      console.error("Error fetching chapter pages:", err);
    } finally {
      setLoading(false);
    }
  }, [chapterId, mangaId]);

  useEffect(() => {
    fetchChapterPages();
  }, [fetchChapterPages]);

  const saveProgress = useCallback(
    async (page: number) => {
      await storage.saveReadingProgress({
        mangaId,
        chapterId,
        chapterNumber,
        page,
        totalPages: pages.length,
        updatedAt: Date.now(),
      });
    },
    [mangaId, chapterId, chapterNumber, pages.length],
  );

  useEffect(() => {
    if (pages.length > 0 && currentPage >= 0) {
      saveProgress(currentPage);
    }
  }, [currentPage, pages.length, saveProgress]);

  const toggleUI = useCallback(() => {
    const newShowUI = !showUI;
    setShowUI(newShowUI);
    uiOpacity.value = withTiming(newShowUI ? 1 : 0, { duration: 200 });

    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }

    if (newShowUI) {
      hideTimerRef.current = setTimeout(() => {
        setShowUI(false);
        uiOpacity.value = withTiming(0, { duration: 200 });
      }, 4000);
    }
  }, [showUI, uiOpacity]);

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const goToNextPage = useCallback(() => {
    if (currentPage < pages.length - 1) {
      const nextPage = currentPage + 1;
      flatListRef.current?.scrollToIndex({ index: nextPage, animated: true });
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  }, [currentPage, pages.length]);

  const goToPrevPage = useCallback(() => {
    if (currentPage > 0) {
      const prevPage = currentPage - 1;
      flatListRef.current?.scrollToIndex({ index: prevPage, animated: true });
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  }, [currentPage]);

  useEffect(() => {
    if (Platform.OS === "web") {
      const handleKeyDown = (event: KeyboardEvent) => {
        switch (event.key) {
          case "ArrowDown":
          case "ArrowRight":
          case "PageDown":
          case " ":
            event.preventDefault();
            goToNextPage();
            break;
          case "ArrowUp":
          case "ArrowLeft":
          case "PageUp":
            event.preventDefault();
            goToPrevPage();
            break;
          case "Escape":
            handleClose();
            break;
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [goToNextPage, goToPrevPage, handleClose]);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const firstVisible = viewableItems[0];
      if (firstVisible && typeof firstVisible.index === "number") {
        setCurrentPage(firstVisible.index);
      }
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const renderPage = useCallback(
    ({ item, index }: { item: string; index: number }) => {
      return <PageItem uri={item} index={index} onPress={toggleUI} />;
    },
    [toggleUI],
  );

  const keyExtractor = useCallback((_: string, index: number) => `page-${index}`, []);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: Colors.dark.readerBackground }]}>
        <StatusBar style="light" />
        <LoadingIndicator fullScreen />
      </View>
    );
  }

  if (pages.length === 0) {
    return (
      <View style={[styles.container, styles.emptyContainer, { backgroundColor: Colors.dark.readerBackground }]}>
        <StatusBar style="light" />
        <Feather name="alert-circle" size={48} color="#666" />
        <ThemedText type="body" style={styles.emptyText} lightColor="#999" darkColor="#999">
          No pages available for this chapter
        </ThemedText>
        <Pressable
          onPress={handleClose}
          style={({ pressed }) => [
            styles.backButton,
            { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <ThemedText type="body" lightColor="#FFFFFF" darkColor="#FFFFFF">
            Go Back
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: Colors.dark.readerBackground }]}>
      <StatusBar style="light" hidden={!showUI} />

      <FlatList
        ref={flatListRef}
        data={pages}
        renderItem={renderPage}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        removeClippedSubviews={Platform.OS !== "web"}
        maxToRenderPerBatch={3}
        windowSize={5}
        initialNumToRender={2}
        contentContainerStyle={styles.listContent}
      />

      {!showUI && (
        <View style={[styles.floatingIndicator, { bottom: Math.max(insets.bottom, Spacing.md) + Spacing.sm }]}>
          <ThemedText
            type="caption"
            lightColor="#FFFFFF"
            darkColor="#FFFFFF"
            style={styles.floatingIndicatorText}
          >
            {currentPage + 1} / {pages.length}
          </ThemedText>
        </View>
      )}

      <Animated.View
        style={[
          styles.header,
          { paddingTop: insets.top, pointerEvents: showUI ? "auto" : "none" },
          animatedHeaderStyle,
        ]}
      >
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
        <Pressable
          onPress={handleClose}
          style={({ pressed }) => [
            styles.headerButton,
            { opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Feather name="x" size={24} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerTitleContainer}>
          <ThemedText
            type="small"
            style={styles.headerTitle}
            numberOfLines={1}
            lightColor="#FFFFFF"
            darkColor="#FFFFFF"
          >
            {mangaTitle}
          </ThemedText>
        </View>
        <View style={styles.headerButton} />
      </Animated.View>

      <Animated.View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom, Spacing.sm), pointerEvents: showUI ? "auto" : "none" },
          animatedFooterStyle,
        ]}
      >
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.footerContent}>
          <View style={styles.navigationRow}>
            <Pressable
              onPress={goToPrevPage}
              disabled={currentPage === 0}
              style={({ pressed }) => [
                styles.navButton,
                { opacity: currentPage === 0 ? 0.3 : pressed ? 0.6 : 1 },
              ]}
            >
              <Feather name="chevron-up" size={24} color="#FFFFFF" />
            </Pressable>
            <ThemedText
              type="body"
              style={styles.pageIndicator}
              lightColor="#FFFFFF"
              darkColor="#FFFFFF"
            >
              {currentPage + 1} / {pages.length}
            </ThemedText>
            <Pressable
              onPress={goToNextPage}
              disabled={currentPage === pages.length - 1}
              style={({ pressed }) => [
                styles.navButton,
                { opacity: currentPage === pages.length - 1 ? 0.3 : pressed ? 0.6 : 1 },
              ]}
            >
              <Feather name="chevron-down" size={24} color="#FFFFFF" />
            </Pressable>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${((currentPage + 1) / pages.length) * 100}%`,
                  backgroundColor: Colors.dark.accent,
                },
              ]}
            />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.lg,
  },
  emptyText: {
    textAlign: "center",
  },
  backButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  listContent: {
    paddingTop: 0,
    paddingBottom: 0,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.xs,
    overflow: "hidden",
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontWeight: "600",
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    overflow: "hidden",
  },
  footerContent: {
    alignItems: "center",
    gap: Spacing.xs,
  },
  navigationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
  },
  navButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: BorderRadius.full,
  },
  pageIndicator: {
    fontWeight: "600",
    minWidth: 80,
    textAlign: "center",
  },
  progressBar: {
    width: "100%",
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  pageContainer: {
    width: SCREEN_WIDTH,
    justifyContent: "center",
    alignItems: "center",
  },
  pageImage: {
    width: "100%",
    height: "100%",
  },
  floatingIndicator: {
    position: "absolute",
    right: Spacing.md,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  floatingIndicatorText: {
    fontWeight: "500",
    opacity: 0.9,
  },
});
