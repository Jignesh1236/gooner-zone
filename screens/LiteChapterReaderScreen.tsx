import React, { useEffect, useState, useCallback, useRef, memo, useMemo } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Dimensions,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  ListRenderItem,
  ViewToken,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
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
import { useVolumeScroll } from "@/hooks/useVolumeScroll";

type LiteChapterReaderParams = {
  LiteChapterReader: {
    chapterId: string;
    mangaId: string;
    mangaTitle: string;
    chapterNumber: string;
  };
};

type LiteChapterReaderScreenProps = NativeStackScreenProps<LiteChapterReaderParams, "LiteChapterReader">;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const INITIAL_BATCH_SIZE = 5;
const LOAD_AHEAD_COUNT = 3;
const PRELOAD_AHEAD_COUNT = 5;
const MAX_PAGE_HEIGHT = SCREEN_HEIGHT * 3;
const TALL_IMAGE_THRESHOLD = 4;
const CHUNK_HEIGHT_CM = 5;
const PIXELS_PER_CM = 38;
const CHUNK_HEIGHT_PX = CHUNK_HEIGHT_CM * PIXELS_PER_CM;

type ImageFitMode = 'contain' | 'cover' | 'none';

const getContainerHeight = (imgWidth: number, imgHeight: number, fitMode: ImageFitMode): number => {
  switch (fitMode) {
    case 'contain':
      return (SCREEN_WIDTH / imgWidth) * imgHeight;
    case 'cover':
      return SCREEN_HEIGHT * 0.9;
    case 'none':
      return imgHeight;
  }
};


interface ChunkData {
  chunkIndex: number;
  totalChunks: number;
  startY: number;
  chunkHeight: number;
  originalWidth: number;
  originalHeight: number;
}

interface PageData {
  uri: string;
  index: number;
  loaded: boolean;
  height: number;
  isTallImage?: boolean;
  chunks?: ChunkData[];
}

interface TallImageChunkProps {
  uri: string;
  chunk: ChunkData;
  pageIndex: number;
  chunkOffsetY: number;
  scrollOffset: number;
  fitMode: ImageFitMode;
}

const TallImageChunk = memo(({ uri, chunk, pageIndex, chunkOffsetY, scrollOffset, fitMode }: TallImageChunkProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [imageReady, setImageReady] = useState(false);

  const scale = fitMode === 'none' ? 1 : SCREEN_WIDTH / chunk.originalWidth;
  const scaledChunkHeight = chunk.chunkHeight * scale;
  const containerWidth = fitMode === 'none' ? chunk.originalWidth : SCREEN_WIDTH;

  const chunkTop = chunkOffsetY;
  const chunkBottom = chunkOffsetY + scaledChunkHeight;
  const viewportTop = scrollOffset - SCREEN_HEIGHT;
  const viewportBottom = scrollOffset + SCREEN_HEIGHT * 2;
  
  const isChunkVisible = chunkBottom > viewportTop && chunkTop < viewportBottom;
  const shouldLoadChunk = chunkBottom > (viewportTop - SCREEN_HEIGHT) && chunkTop < (viewportBottom + SCREEN_HEIGHT);

  const handleRetry = useCallback(() => {
    setError(false);
    setLoading(true);
    setRetryKey((k) => k + 1);
  }, []);

  return (
    <View style={[styles.chunkWrapper, { height: scaledChunkHeight, width: containerWidth }]}>
      {!shouldLoadChunk && (
        <View style={styles.placeholderOverlay}>
          <View style={styles.placeholderContent}>
            <ThemedText type="caption" lightColor="#555" darkColor="#555">
              {pageIndex + 1}.{chunk.chunkIndex + 1}
            </ThemedText>
          </View>
        </View>
      )}

      {shouldLoadChunk && loading && !error && (
        <View style={styles.loadingOverlay}>
          <View style={styles.shimmerContainer}>
            <View style={styles.shimmerEffect} />
          </View>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="small" color={Colors.dark.accent} />
            <ThemedText type="caption" lightColor="#666" darkColor="#666" style={styles.loadingText}>
              Loading {chunk.chunkIndex + 1}/{chunk.totalChunks}...
            </ThemedText>
          </View>
        </View>
      )}

      {error && (
        <View style={styles.errorOverlay}>
          <Feather name="image" size={24} color="#666" />
          <ThemedText type="caption" lightColor="#666" darkColor="#666">
            Failed to load chunk
          </ThemedText>
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

      {shouldLoadChunk && (
        <View style={[styles.chunkImageContainer, { height: scaledChunkHeight, width: containerWidth, overflow: 'hidden' }]}>
          <Image
            key={`${uri}-chunk-${chunk.chunkIndex}-${retryKey}`}
            source={{ uri }}
            style={[
              styles.chunkImage,
              {
                opacity: imageReady ? 1 : 0,
                width: containerWidth,
                height: chunk.originalHeight * scale,
                transform: [{ translateY: -chunk.startY * scale }],
              }
            ]}
            contentFit="fill"
            cachePolicy="memory-disk"
            recyclingKey={uri}
            priority={isChunkVisible ? "high" : "low"}
            onLoadStart={() => {
              setLoading(true);
              setError(false);
            }}
            onLoad={() => {
              setLoading(false);
              setImageReady(true);
            }}
            onError={() => {
              setLoading(false);
              setError(true);
            }}
          />
        </View>
      )}
    </View>
  );
}, (prevProps, nextProps) => {
  const prevVisible = (() => {
    const scale = prevProps.fitMode === 'none' ? 1 : SCREEN_WIDTH / prevProps.chunk.originalWidth;
    const scaledChunkHeight = prevProps.chunk.chunkHeight * scale;
    const chunkTop = prevProps.chunkOffsetY;
    const chunkBottom = prevProps.chunkOffsetY + scaledChunkHeight;
    const viewportTop = prevProps.scrollOffset - SCREEN_HEIGHT * 2;
    const viewportBottom = prevProps.scrollOffset + SCREEN_HEIGHT * 3;
    return chunkBottom > viewportTop && chunkTop < viewportBottom;
  })();
  
  const nextVisible = (() => {
    const scale = nextProps.fitMode === 'none' ? 1 : SCREEN_WIDTH / nextProps.chunk.originalWidth;
    const scaledChunkHeight = nextProps.chunk.chunkHeight * scale;
    const chunkTop = nextProps.chunkOffsetY;
    const chunkBottom = nextProps.chunkOffsetY + scaledChunkHeight;
    const viewportTop = nextProps.scrollOffset - SCREEN_HEIGHT * 2;
    const viewportBottom = nextProps.scrollOffset + SCREEN_HEIGHT * 3;
    return chunkBottom > viewportTop && chunkTop < viewportBottom;
  })();

  return (
    prevProps.uri === nextProps.uri &&
    prevProps.chunk.chunkIndex === nextProps.chunk.chunkIndex &&
    prevProps.fitMode === nextProps.fitMode &&
    prevVisible === nextVisible
  );
});

interface LitePageItemProps {
  uri: string;
  index: number;
  isVisible: boolean;
  shouldLoad: boolean;
  onImageLoad: (index: number, height: number, isTallImage?: boolean, chunks?: ChunkData[]) => void;
  fitMode: ImageFitMode;
  scrollOffset: number;
  pageOffsetY: number;
}

const LitePageItem = memo(({ uri, index, isVisible, shouldLoad, onImageLoad, fitMode, scrollOffset, pageOffsetY }: LitePageItemProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [height, setHeight] = useState(fitMode === 'cover' ? SCREEN_HEIGHT * 0.9 : SCREEN_WIDTH * 1.4);
  const [imageReady, setImageReady] = useState(false);
  const [isTallImage, setIsTallImage] = useState(false);
  const [chunks, setChunks] = useState<ChunkData[]>([]);

  const handleRetry = useCallback(() => {
    setError(false);
    setLoading(true);
    setRetryKey((k) => k + 1);
  }, []);

  const actuallyLoad = shouldLoad || isVisible;
  const imageWidth = fitMode === 'none' ? undefined : SCREEN_WIDTH;

  const calculateChunks = useCallback((imgWidth: number, imgHeight: number): ChunkData[] => {
    const aspectRatio = imgHeight / imgWidth;
    if (aspectRatio < TALL_IMAGE_THRESHOLD) return [];

    const chunkCount = Math.ceil(imgHeight / CHUNK_HEIGHT_PX);
    const calculatedChunks: ChunkData[] = [];

    for (let i = 0; i < chunkCount; i++) {
      const startY = i * CHUNK_HEIGHT_PX;
      const remainingHeight = imgHeight - startY;
      const chunkHeight = Math.min(CHUNK_HEIGHT_PX, remainingHeight);

      calculatedChunks.push({
        chunkIndex: i,
        totalChunks: chunkCount,
        startY,
        chunkHeight,
        originalWidth: imgWidth,
        originalHeight: imgHeight,
      });
    }

    return calculatedChunks;
  }, []);

  if (isTallImage && chunks.length > 0) {
    const scale = fitMode === 'none' ? 1 : SCREEN_WIDTH / chunks[0].originalWidth;
    let cumulativeChunkOffset = 0;
    
    return (
      <View style={{ width: fitMode === 'none' ? undefined : SCREEN_WIDTH }}>
        {chunks.map((chunk) => {
          const chunkOffsetY = pageOffsetY + cumulativeChunkOffset;
          cumulativeChunkOffset += chunk.chunkHeight * scale;
          
          return (
            <TallImageChunk
              key={`${uri}-chunk-${chunk.chunkIndex}`}
              uri={uri}
              chunk={chunk}
              pageIndex={index}
              chunkOffsetY={chunkOffsetY}
              scrollOffset={scrollOffset}
              fitMode={fitMode}
            />
          );
        })}
      </View>
    );
  }

  return (
    <View style={[styles.pageWrapper, { height, width: fitMode === 'none' ? undefined : SCREEN_WIDTH }]}>
      {!actuallyLoad && (
        <View style={styles.placeholderOverlay}>
          <View style={styles.placeholderContent}>
            <ThemedText type="caption" lightColor="#555" darkColor="#555">
              {index + 1}
            </ThemedText>
          </View>
        </View>
      )}

      {actuallyLoad && loading && !error && (
        <View style={styles.loadingOverlay}>
          <View style={styles.shimmerContainer}>
            <View style={styles.shimmerEffect} />
          </View>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="small" color={Colors.dark.accent} />
            <ThemedText type="caption" lightColor="#666" darkColor="#666" style={styles.loadingText}>
              Loading page {index + 1}...
            </ThemedText>
          </View>
        </View>
      )}

      {error && (
        <View style={styles.errorOverlay}>
          <Feather name="image" size={24} color="#666" />
          <ThemedText type="caption" lightColor="#666" darkColor="#666">
            Failed to load
          </ThemedText>
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

      {actuallyLoad && (
        <Image
          key={`${uri}-${retryKey}`}
          source={{ uri }}
          style={[styles.pageImage, { opacity: imageReady ? 1 : 0, width: imageWidth }]}
          contentFit={fitMode}
          cachePolicy="memory-disk"
          recyclingKey={uri}
          priority={isVisible ? "high" : index < 10 ? "normal" : "low"}
          onLoadStart={() => {
            setLoading(true);
            setError(false);
          }}
          onLoad={(e) => {
            setLoading(false);
            setImageReady(true);
            const { width, height: imgHeight } = e.source;
            if (width && imgHeight) {
              const calculatedChunks = calculateChunks(width, imgHeight);
              
              if (calculatedChunks.length > 0) {
                setIsTallImage(true);
                setChunks(calculatedChunks);
                const scale = fitMode === 'none' ? 1 : SCREEN_WIDTH / width;
                const totalHeight = imgHeight * scale;
                setHeight(totalHeight);
                onImageLoad(index, totalHeight, true, calculatedChunks);
              } else {
                const newHeight = getContainerHeight(width, imgHeight, fitMode);
                setHeight(newHeight);
                onImageLoad(index, newHeight, false);
              }
            }
          }}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
        />
      )}
    </View>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.uri === nextProps.uri &&
    prevProps.index === nextProps.index &&
    prevProps.isVisible === nextProps.isVisible &&
    prevProps.shouldLoad === nextProps.shouldLoad &&
    prevProps.fitMode === nextProps.fitMode &&
    prevProps.pageOffsetY === nextProps.pageOffsetY &&
    prevProps.scrollOffset === nextProps.scrollOffset
  );
});

export default function LiteChapterReaderScreen({
  navigation,
  route,
}: LiteChapterReaderScreenProps) {
  const { chapterId, mangaId, mangaTitle, chapterNumber } = route.params;
  const insets = useSafeAreaInsets();
  
  useKeepAwake();

  const flatListRef = useRef<FlatList<PageData>>(null);
  const [allPageUrls, setAllPageUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [showHeader, setShowHeader] = useState(true);
  const [initialScrollDone, setInitialScrollDone] = useState(false);
  const [visibleIndices, setVisibleIndices] = useState<Set<number>>(new Set([0, 1, 2]));
  const [loadedBatchEnd, setLoadedBatchEnd] = useState(INITIAL_BATCH_SIZE);
  const [fitMode, setFitMode] = useState<ImageFitMode>('contain');
  const [scrollOffset, setScrollOffset] = useState(0);
  const [volumeScrollEnabled, setVolumeScrollEnabled] = useState(true);
  const [volumeScrollSensitivity, setVolumeScrollSensitivity] = useState(50);

  const savedStartPageRef = useRef(0);
  const currentScrollOffsetRef = useRef(0);
  const pageHeightsRef = useRef<Map<number, number>>(new Map());
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const preloadedRef = useRef<Set<number>>(new Set());

  const pages = useMemo<PageData[]>(() => {
    return allPageUrls.map((uri, index) => ({
      uri,
      index,
      loaded: index < loadedBatchEnd,
      height: pageHeightsRef.current.get(index) || SCREEN_WIDTH * 1.4,
    }));
  }, [allPageUrls, loadedBatchEnd]);

  const calculateScrollAmount = useCallback((sensitivity: number) => {
    const minAmount = 100;
    const maxAmount = 400;
    const normalizedSensitivity = Math.max(10, Math.min(100, sensitivity));
    return minAmount + ((normalizedSensitivity - 10) / 90) * (maxAmount - minAmount);
  }, []);

  const handleVolumeScrollUp = useCallback(() => {
    const scrollAmount = calculateScrollAmount(volumeScrollSensitivity);
    const newOffset = Math.max(0, currentScrollOffsetRef.current - scrollAmount);
    flatListRef.current?.scrollToOffset({ offset: newOffset, animated: true });
  }, [volumeScrollSensitivity, calculateScrollAmount]);

  const handleVolumeScrollDown = useCallback(() => {
    const scrollAmount = calculateScrollAmount(volumeScrollSensitivity);
    const newOffset = currentScrollOffsetRef.current + scrollAmount;
    flatListRef.current?.scrollToOffset({ offset: newOffset, animated: true });
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

  useEffect(() => {
    if (!loading && allPageUrls.length > 0 && !initialScrollDone && savedStartPageRef.current > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: savedStartPageRef.current,
          animated: false,
        });
        setInitialScrollDone(true);
        const startIndex = savedStartPageRef.current;
        setVisibleIndices(new Set([startIndex - 1, startIndex, startIndex + 1].filter(i => i >= 0)));
        setLoadedBatchEnd(Math.max(INITIAL_BATCH_SIZE, startIndex + LOAD_AHEAD_COUNT + 1));
      }, 100);
    }
  }, [loading, allPageUrls.length, initialScrollDone]);

  useEffect(() => {
    if (allPageUrls.length === 0) return;

    const currentVisible = Array.from(visibleIndices);
    const maxVisible = Math.max(...currentVisible, 0);

    const newBatchEnd = Math.min(
      allPageUrls.length,
      Math.max(loadedBatchEnd, maxVisible + LOAD_AHEAD_COUNT + 1)
    );

    if (newBatchEnd > loadedBatchEnd) {
      setLoadedBatchEnd(newBatchEnd);
    }

    preloadImages(maxVisible);
  }, [visibleIndices, allPageUrls.length]);

  const preloadImages = useCallback((currentMax: number) => {
    const toPreload: string[] = [];
    
    for (let i = currentMax + 1; i <= currentMax + PRELOAD_AHEAD_COUNT && i < allPageUrls.length; i++) {
      if (!preloadedRef.current.has(i)) {
        toPreload.push(allPageUrls[i]);
        preloadedRef.current.add(i);
      }
    }

    if (toPreload.length > 0) {
      Image.prefetch(toPreload, "memory-disk");
    }
  }, [allPageUrls]);

  const loadChapter = async (isRefresh = false) => {
    try {
      if (!isRefresh) {
        setLoading(true);
      }

      preloadedRef.current.clear();

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
        pageHeightsRef.current.clear();
        setAllPageUrls(pageUrls);

        const startPage = savedStartPageRef.current;
        const initialBatch = Math.max(INITIAL_BATCH_SIZE, startPage + LOAD_AHEAD_COUNT + 1);
        setLoadedBatchEnd(Math.min(pageUrls.length, initialBatch));
        
        setCurrentPage(startPage);
        setVisibleIndices(new Set([startPage - 1, startPage, startPage + 1].filter(i => i >= 0 && i < pageUrls.length)));
        setInitialScrollDone(false);

        const preloadUrls = pageUrls.slice(0, Math.min(3, pageUrls.length));
        Image.prefetch(preloadUrls, "memory-disk");

        await storage.markChapterAsRead(mangaId, chapterId);
      } else {
        setAllPageUrls([]);
      }
    } catch (err) {
      console.error("Failed to load chapter:", err);
      setAllPageUrls([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadChapter(true);
  }, [chapterId]);

  const saveProgress = useCallback(
    async (page: number) => {
      if (allPageUrls.length === 0) return;
      await storage.saveReadingProgress({
        mangaId,
        chapterId,
        chapterNumber,
        page,
        totalPages: allPageUrls.length,
        updatedAt: Date.now(),
      });
    },
    [mangaId, chapterId, chapterNumber, allPageUrls.length]
  );

  const handleImageLoad = useCallback((index: number, height: number) => {
    pageHeightsRef.current.set(index, height);
  }, []);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const visible = new Set<number>();
    let maxIndex = 0;

    viewableItems.forEach((item) => {
      if (item.isViewable && item.index !== null) {
        visible.add(item.index);
        maxIndex = Math.max(maxIndex, item.index);
      }
    });

    if (visible.size > 0) {
      setVisibleIndices(visible);
      
      const viewableIndices = viewableItems
        .filter(item => item.isViewable && item.index !== null)
        .map(item => item.index as number);
      
      if (viewableIndices.length > 0) {
        const centerIndex = viewableIndices[Math.floor(viewableIndices.length / 2)];
        setCurrentPage(centerIndex);
      }
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 20,
    minimumViewTime: 100,
  }).current;

  const lastScrollOffsetRef = useRef(0);
  const SCROLL_UPDATE_THRESHOLD = 100;

  const handleScroll = useCallback((event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    currentScrollOffsetRef.current = offsetY;
    
    if (Math.abs(offsetY - lastScrollOffsetRef.current) >= SCROLL_UPDATE_THRESHOLD) {
      lastScrollOffsetRef.current = offsetY;
      setScrollOffset(offsetY);
    }

    if (offsetY > 50) {
      if (showHeader) setShowHeader(false);
    } else {
      if (!showHeader) setShowHeader(true);
    }
  }, [showHeader]);

  const handleScrollEnd = useCallback(() => {
    saveProgress(currentPage);
  }, [currentPage, saveProgress]);

  const goBack = useCallback(() => navigation.goBack(), [navigation]);

  const toggleHeader = useCallback(() => {
    setShowHeader(prev => !prev);
  }, []);

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

  const shouldLoadPage = useCallback((index: number): boolean => {
    if (index < loadedBatchEnd) return true;
    
    const visibleArray = Array.from(visibleIndices);
    const maxVisible = Math.max(...visibleArray, 0);
    const minVisible = Math.min(...visibleArray, 0);
    
    return index >= minVisible - 2 && index <= maxVisible + LOAD_AHEAD_COUNT;
  }, [visibleIndices, loadedBatchEnd]);

  const getPageOffsetY = useCallback((index: number): number => {
    let offset = 0;
    for (let i = 0; i < index; i++) {
      offset += pageHeightsRef.current.get(i) || SCREEN_WIDTH * 1.4;
    }
    return offset;
  }, []);

  const renderPage: ListRenderItem<PageData> = useCallback(({ item }) => {
    const isVisible = visibleIndices.has(item.index);
    const shouldLoad = shouldLoadPage(item.index);
    const pageOffsetY = getPageOffsetY(item.index);
    
    return (
      <Pressable onPress={toggleHeader}>
        <LitePageItem 
          uri={item.uri} 
          index={item.index}
          isVisible={isVisible}
          shouldLoad={shouldLoad}
          onImageLoad={handleImageLoad}
          fitMode={fitMode}
          scrollOffset={scrollOffset}
          pageOffsetY={pageOffsetY}
        />
      </Pressable>
    );
  }, [toggleHeader, visibleIndices, shouldLoadPage, handleImageLoad, fitMode, scrollOffset, getPageOffsetY]);

  const getItemLayout = useCallback((_: any, index: number) => {
    const height = pageHeightsRef.current.get(index) || SCREEN_WIDTH * 1.4;
    let offset = 0;
    for (let i = 0; i < index; i++) {
      offset += pageHeightsRef.current.get(i) || SCREEN_WIDTH * 1.4;
    }
    return { length: height, offset, index };
  }, []);

  const keyExtractor = useCallback((item: PageData) => `page-${item.index}`, []);

  const onScrollToIndexFailed = useCallback((info: { index: number }) => {
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({
        index: info.index,
        animated: false,
      });
    }, 500);
  }, []);

  const onEndReached = useCallback(() => {
    if (loadedBatchEnd < allPageUrls.length) {
      setLoadedBatchEnd(prev => Math.min(allPageUrls.length, prev + LOAD_AHEAD_COUNT));
    }
  }, [loadedBatchEnd, allPageUrls.length]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar style="light" />
        <LoadingIndicator fullScreen />
      </View>
    );
  }

  if (allPageUrls.length === 0) {
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

  const progress = ((currentPage + 1) / allPageUrls.length) * 100;
  const loadingProgress = Math.round((loadedBatchEnd / allPageUrls.length) * 100);

  return (
    <View style={styles.container}>
      <StatusBar style="light" hidden={!showHeader} />

      <FlatList
        ref={flatListRef}
        data={pages}
        renderItem={renderPage}
        keyExtractor={keyExtractor}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onScrollToIndexFailed={onScrollToIndexFailed}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        initialNumToRender={INITIAL_BATCH_SIZE}
        maxToRenderPerBatch={3}
        windowSize={7}
        removeClippedSubviews={true}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        updateCellsBatchingPeriod={50}
        onMomentumScrollEnd={handleScrollEnd}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.dark.accent}
            colors={[Colors.dark.accent]}
            progressBackgroundColor="#1E1E1E"
          />
        }
      />

      {showHeader && (
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable
            onPress={goBack}
            style={({ pressed }) => [
              styles.headerBtn,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Feather name="arrow-left" size={22} color="#FFF" />
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
          <View style={styles.headerRight}>
            <Pressable
              onPress={cycleFitMode}
              style={({ pressed }) => [
                styles.fitModeBtn,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Feather name={getFitModeIcon(fitMode) as any} size={14} color="#FFF" />
              <ThemedText type="caption" lightColor="#FFF" darkColor="#FFF">
                {getFitModeLabel(fitMode)}
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={onRefresh}
              style={({ pressed }) => [
                styles.headerBtn,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Feather name="refresh-cw" size={18} color="#FFF" />
            </Pressable>
          </View>
        </View>
      )}

      <View
        style={[
          styles.bottomIndicator,
          { bottom: Math.max(insets.bottom, 8) + 8 },
        ]}
      >
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${progress}%` }]} />
          {loadingProgress < 100 && (
            <View style={[styles.loadingProgressBar, { width: `${loadingProgress}%` }]} />
          )}
        </View>
        <ThemedText
          type="caption"
          lightColor="#FFF"
          darkColor="#FFF"
          style={styles.pageIndicatorText}
        >
          {currentPage + 1} / {allPageUrls.length}
        </ThemedText>
      </View>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  pageWrapper: {
    width: SCREEN_WIDTH,
    backgroundColor: "#000",
  },
  pageImage: {
    width: SCREEN_WIDTH,
    height: "100%",
  },
  chunkWrapper: {
    backgroundColor: "#000",
  },
  chunkImageContainer: {
    backgroundColor: "#000",
  },
  chunkImage: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  placeholderOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0a0a0a",
  },
  placeholderContent: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1a1a1a",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0a0a0a",
    zIndex: 1,
  },
  shimmerContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  shimmerEffect: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#111",
  },
  loadingContent: {
    alignItems: "center",
    gap: Spacing.xs,
  },
  loadingText: {
    marginTop: 4,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#111",
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
    marginTop: Spacing.xs,
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
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
    backgroundColor: "rgba(0,0,0,0.9)",
  },
  headerBtn: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
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
  titleText: {
    fontWeight: "600",
    textAlign: "center",
  },
  bottomIndicator: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: "rgba(0,0,0,0.8)",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  progressBarContainer: {
    flex: 1,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBar: {
    position: "absolute",
    height: "100%",
    backgroundColor: Colors.dark.accent,
    borderRadius: 2,
    zIndex: 2,
  },
  loadingProgressBar: {
    position: "absolute",
    height: "100%",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 2,
    zIndex: 1,
  },
  pageIndicatorText: {
    fontWeight: "600",
    fontSize: 12,
    minWidth: 50,
    textAlign: "right",
  },
});
