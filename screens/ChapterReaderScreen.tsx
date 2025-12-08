import React, { useEffect, useState, useCallback, useRef, memo } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Dimensions,
  FlatList,
  Platform,
  ActivityIndicator,
  ViewToken,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useKeepAwake } from "expo-keep-awake";

import { ThemedText } from "@/components/ThemedText";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { mangadexApi } from "@/services/mangadex";
import { storage, AppSettings } from "@/services/storage";
import { downloadManager } from "@/services/downloadManager";
import { BrowseStackParamList } from "@/navigation/BrowseStackNavigator";
import { useVolumeScroll } from "@/hooks/useVolumeScroll";

type ChapterReaderScreenProps = {
  navigation: NativeStackNavigationProp<BrowseStackParamList, "ChapterReader">;
  route: RouteProp<BrowseStackParamList, "ChapterReader">;
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const ESTIMATED_PAGE_HEIGHT = SCREEN_WIDTH * 1.4;
const MAX_PAGE_HEIGHT = SCREEN_HEIGHT * 3;
const TALL_IMAGE_THRESHOLD = 4;

type ImageFitMode = 'contain' | 'cover' | 'none';

interface PageItemProps {
  uri: string;
  index: number;
  onTap: () => void;
  fitMode: ImageFitMode;
}

const getContainerHeight = (imgWidth: number, imgHeight: number, fitMode: ImageFitMode): number => {
  const aspectRatio = imgHeight / imgWidth;
  
  switch (fitMode) {
    case 'contain':
      // Fit mode: width = screen width, height adjusts naturally (no limit)
      return (SCREEN_WIDTH / imgWidth) * imgHeight;
    case 'cover':
      // Zoom mode: fixed height, image covers the area
      return SCREEN_HEIGHT * 0.9;
    case 'none':
      // Original mode: original image size
      return imgHeight;
  }
};

const PageItem = memo(({ uri, index, onTap, fitMode }: PageItemProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [height, setHeight] = useState(fitMode === 'cover' ? SCREEN_HEIGHT * 0.9 : ESTIMATED_PAGE_HEIGHT);

  const handleRetry = useCallback(() => {
    setError(false);
    setLoading(true);
    setRetryKey((k) => k + 1);
  }, []);

  const imageWidth = fitMode === 'none' ? undefined : SCREEN_WIDTH;
  
  return (
    <Pressable onPress={onTap} style={[styles.pageWrapper, { height, width: fitMode === 'none' ? undefined : SCREEN_WIDTH }]}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color={Colors.dark.accent} />
        </View>
      )}

      {error && (
        <View style={styles.errorOverlay}>
          <Feather name="image" size={28} color="#666" />
          <Pressable
            onPress={handleRetry}
            style={({ pressed }) => [
              styles.retryBtn,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Feather name="refresh-cw" size={12} color="#FFF" />
            <ThemedText type="caption" lightColor="#FFF" darkColor="#FFF">
              Retry
            </ThemedText>
          </Pressable>
        </View>
      )}

      <Image
        key={`${uri}-${retryKey}`}
        source={{ uri }}
        style={[styles.pageImage, { width: imageWidth }]}
        contentFit={fitMode}
        cachePolicy="memory-disk"
        recyclingKey={uri}
        priority={index < 3 ? "high" : "low"}
        onLoadStart={() => {
          setLoading(true);
          setError(false);
        }}
        onLoad={(e) => {
          setLoading(false);
          const { width, height: imgHeight } = e.source;
          if (width && imgHeight) {
            const newHeight = getContainerHeight(width, imgHeight, fitMode);
            setHeight(newHeight);
          }
        }}
        onError={() => {
          setLoading(false);
          setError(true);
        }}
      />
    </Pressable>
  );
});

export default function ChapterReaderScreen({
  navigation,
  route,
}: ChapterReaderScreenProps) {
  const { chapterId, mangaId, mangaTitle, chapterNumber } = route.params;
  const insets = useSafeAreaInsets();
  
  useKeepAwake();

  const listRef = useRef<FlatList>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const [initialScrollDone, setInitialScrollDone] = useState(false);
  const [fitMode, setFitMode] = useState<ImageFitMode>('contain');
  const [showFitMenu, setShowFitMenu] = useState(false);
  const [volumeScrollEnabled, setVolumeScrollEnabled] = useState(true);
  const [volumeScrollSensitivity, setVolumeScrollSensitivity] = useState(50);

  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const savedStartPageRef = useRef(0);
  const currentScrollOffsetRef = useRef(0);

  const calculateScrollAmount = useCallback((sensitivity: number) => {
    const minAmount = 100;
    const maxAmount = 400;
    const normalizedSensitivity = Math.max(10, Math.min(100, sensitivity));
    return minAmount + ((normalizedSensitivity - 10) / 90) * (maxAmount - minAmount);
  }, []);

  const handleVolumeScrollUp = useCallback(() => {
    const scrollAmount = calculateScrollAmount(volumeScrollSensitivity);
    const newOffset = Math.max(0, currentScrollOffsetRef.current - scrollAmount);
    listRef.current?.scrollToOffset({ offset: newOffset, animated: true });
  }, [volumeScrollSensitivity, calculateScrollAmount]);

  const handleVolumeScrollDown = useCallback(() => {
    const scrollAmount = calculateScrollAmount(volumeScrollSensitivity);
    const newOffset = currentScrollOffsetRef.current + scrollAmount;
    listRef.current?.scrollToOffset({ offset: newOffset, animated: true });
  }, [volumeScrollSensitivity, calculateScrollAmount]);

  useVolumeScroll({
    enabled: volumeScrollEnabled,
    sensitivity: volumeScrollSensitivity,
    onScrollUp: handleVolumeScrollUp,
    onScrollDown: handleVolumeScrollDown,
  });

  useEffect(() => {
    loadChapter();
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [chapterId]);

  const loadChapter = async () => {
    try {
      setLoading(true);
      setInitialScrollDone(false);

      const [savedProgress, settings, downloadedChapter] = await Promise.all([
        storage.getReadingProgress(mangaId),
        storage.getSettings(),
        downloadManager.getDownloadedChapter(chapterId),
      ]);

      setVolumeScrollEnabled(settings.volumeScrollEnabled ?? true);
      setVolumeScrollSensitivity(settings.volumeScrollSensitivity ?? 50);

      if (savedProgress && savedProgress.chapterId === chapterId) {
        savedStartPageRef.current = savedProgress.page || 0;
      } else {
        savedStartPageRef.current = 0;
      }

      let pageUrls: string[] = [];
      
      if (downloadedChapter && downloadedChapter.pages.length > 0) {
        pageUrls = downloadedChapter.pages;
      } else {
        try {
          const data = await mangadexApi.getChapterPages(chapterId, settings.dataSaver);
          pageUrls = data.pages;
        } catch (apiError) {
          console.error("API fetch failed, no offline data available:", apiError);
          pageUrls = [];
        }
      }
      
      if (pageUrls.length > 0) {
        setPages(pageUrls);
        setCurrentPage(savedStartPageRef.current);
        await storage.markChapterAsRead(mangaId, chapterId);
      } else {
        setPages([]);
      }
    } catch (err) {
      console.error("Failed to load chapter:", err);
      setPages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pages.length > 0 && !initialScrollDone && savedStartPageRef.current > 0) {
      const targetPage = Math.min(savedStartPageRef.current, pages.length - 1);
      setTimeout(() => {
        listRef.current?.scrollToIndex({
          index: targetPage,
          animated: false,
          viewPosition: 0,
        });
        setInitialScrollDone(true);
      }, 100);
    } else if (pages.length > 0 && !initialScrollDone) {
      setInitialScrollDone(true);
    }
  }, [pages, initialScrollDone]);

  const saveProgress = useCallback(
    async (page: number) => {
      if (pages.length === 0) return;
      await storage.saveReadingProgress({
        mangaId,
        chapterId,
        chapterNumber,
        page,
        totalPages: pages.length,
        updatedAt: Date.now(),
      });
    },
    [mangaId, chapterId, chapterNumber, pages.length]
  );

  useEffect(() => {
    if (pages.length > 0 && initialScrollDone) {
      saveProgress(currentPage);
    }
  }, [currentPage, pages.length, saveProgress, initialScrollDone]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        const visibleIndex = viewableItems[0].index ?? 0;
        setCurrentPage(visibleIndex);
      }
    },
    []
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 100,
  }).current;

  const toggleControls = useCallback(() => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);

    const next = !showControls;
    setShowControls(next);

    if (next) {
      hideTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [showControls]);

  const scrollToPage = useCallback(
    (pageIndex: number) => {
      if (pageIndex < 0 || pageIndex >= pages.length) return;
      listRef.current?.scrollToIndex({
        index: pageIndex,
        animated: true,
        viewPosition: 0,
      });
    },
    [pages.length]
  );

  const goBack = useCallback(() => navigation.goBack(), [navigation]);

  const getFitModeLabel = (mode: ImageFitMode) => {
    switch (mode) {
      case 'contain': return 'Fit';
      case 'cover': return 'Zoom';
      case 'none': return 'Original';
    }
  };

  const getFitModeIcon = (mode: ImageFitMode) => {
    switch (mode) {
      case 'contain': return 'maximize';
      case 'cover': return 'zoom-in';
      case 'none': return 'image';
    }
  };

  const cycleFitMode = useCallback(() => {
    setFitMode(prev => {
      switch (prev) {
        case 'contain': return 'cover';
        case 'cover': return 'none';
        case 'none': return 'contain';
      }
    });
  }, []);

  const toggleFitMenu = useCallback(() => {
    setShowFitMenu(prev => !prev);
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: string; index: number }) => (
      <PageItem uri={item} index={index} onTap={toggleControls} fitMode={fitMode} />
    ),
    [toggleControls, fitMode]
  );

  const keyExtractor = useCallback((item: string, index: number) => `${index}`, []);

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: ESTIMATED_PAGE_HEIGHT,
      offset: ESTIMATED_PAGE_HEIGHT * index,
      index,
    }),
    []
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar style="light" />
        <LoadingIndicator fullScreen />
      </View>
    );
  }

  if (pages.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar style="light" />
        <Feather name="alert-circle" size={40} color="#666" />
        <ThemedText
          type="body"
          style={styles.noPageText}
          lightColor="#999"
          darkColor="#999"
        >
          No pages available
        </ThemedText>
        <Pressable
          onPress={goBack}
          style={({ pressed }) => [
            styles.goBackBtn,
            { opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <ThemedText type="body" lightColor="#FFF" darkColor="#FFF">
            Go Back
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  const progress = ((currentPage + 1) / pages.length) * 100;

  return (
    <View style={styles.container}>
      <StatusBar style="light" hidden={!showControls} />

      <FlatList
        ref={listRef}
        data={pages}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={3}
        windowSize={5}
        initialNumToRender={2}
        updateCellsBatchingPeriod={100}
        onScroll={(event) => {
          currentScrollOffsetRef.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            listRef.current?.scrollToIndex({
              index: info.index,
              animated: false,
            });
          }, 100);
        }}
      />

      {!showControls && (
        <View
          style={[
            styles.pageIndicator,
            { bottom: Math.max(insets.bottom, 12) + 8 },
          ]}
        >
          <ThemedText
            type="caption"
            lightColor="#FFF"
            darkColor="#FFF"
            style={styles.pageIndicatorText}
          >
            {currentPage + 1} / {pages.length}
          </ThemedText>
        </View>
      )}

      {showControls && (
        <>
          <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
            <Pressable
              onPress={goBack}
              style={({ pressed }) => [
                styles.headerBtn,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Feather name="x" size={22} color="#FFF" />
            </Pressable>
            <View style={styles.headerCenter}>
              <ThemedText
                type="small"
                numberOfLines={1}
                lightColor="#FFF"
                darkColor="#FFF"
                style={styles.titleText}
              >
                {mangaTitle}
              </ThemedText>
              <ThemedText
                type="caption"
                lightColor="rgba(255,255,255,0.7)"
                darkColor="rgba(255,255,255,0.7)"
              >
                Ch. {chapterNumber}
              </ThemedText>
            </View>
            <Pressable
              onPress={cycleFitMode}
              style={({ pressed }) => [
                styles.fitModeBtn,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Feather name={getFitModeIcon(fitMode) as any} size={16} color="#FFF" />
              <ThemedText type="caption" lightColor="#FFF" darkColor="#FFF">
                {getFitModeLabel(fitMode)}
              </ThemedText>
            </Pressable>
          </View>

          <View
            style={[
              styles.footer,
              { paddingBottom: Math.max(insets.bottom, 8) + 8 },
            ]}
          >
            <View style={styles.navRow}>
              <Pressable
                onPress={() => scrollToPage(currentPage - 1)}
                disabled={currentPage === 0}
                style={({ pressed }) => [
                  styles.navBtn,
                  { opacity: currentPage === 0 ? 0.3 : pressed ? 0.6 : 1 },
                ]}
              >
                <Feather name="chevron-up" size={22} color="#FFF" />
              </Pressable>

              <View style={styles.pageInfo}>
                <ThemedText
                  type="body"
                  lightColor="#FFF"
                  darkColor="#FFF"
                  style={styles.pageNum}
                >
                  {currentPage + 1} / {pages.length}
                </ThemedText>
              </View>

              <Pressable
                onPress={() => scrollToPage(currentPage + 1)}
                disabled={currentPage === pages.length - 1}
                style={({ pressed }) => [
                  styles.navBtn,
                  {
                    opacity:
                      currentPage === pages.length - 1 ? 0.3 : pressed ? 0.6 : 1,
                  },
                ]}
              >
                <Feather name="chevron-down" size={22} color="#FFF" />
              </Pressable>
            </View>

            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progress}%` },
                ]}
              />
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
  },
  noPageText: {
    textAlign: "center",
  },
  goBackBtn: {
    backgroundColor: Colors.dark.accent,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
  },
  pageWrapper: {
    width: SCREEN_WIDTH,
    backgroundColor: "#000",
  },
  pageImage: {
    width: SCREEN_WIDTH,
    height: "100%",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
    zIndex: 1,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
    gap: Spacing.xs,
    zIndex: 2,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.dark.accent,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.xs,
  },
  pageIndicator: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  pageIndicatorText: {
    fontWeight: "600",
    fontSize: 12,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
    backgroundColor: "rgba(0,0,0,0.85)",
  },
  headerBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  fitModeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  titleText: {
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
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center",
    gap: Spacing.sm,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
  },
  navBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: BorderRadius.full,
  },
  pageInfo: {
    alignItems: "center",
    minWidth: 80,
  },
  pageNum: {
    fontWeight: "600",
  },
  progressBar: {
    width: "100%",
    height: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 1,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.dark.accent,
    borderRadius: 1,
  },
});
