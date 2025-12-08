import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useKeepAwake } from "expo-keep-awake";
import WebView, { WebViewMessageEvent } from "react-native-webview";
import * as FileSystem from "expo-file-system/legacy";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { mangadexApi } from "@/services/mangadex";
import { storage, AppSettings } from "@/services/storage";
import { downloadManager } from "@/services/downloadManager";
import { useVolumeScroll } from "@/hooks/useVolumeScroll";

type HtmlChapterReaderParams = {
  HtmlChapterReader: {
    chapterId: string;
    mangaId: string;
    mangaTitle: string;
    chapterNumber: string;
  };
};

type HtmlChapterReaderScreenProps = NativeStackScreenProps<HtmlChapterReaderParams, "HtmlChapterReader">;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type WebViewRef = any;

export default function HtmlChapterReaderScreen({
  navigation,
  route,
}: HtmlChapterReaderScreenProps) {
  const { chapterId, mangaId, mangaTitle, chapterNumber } = route.params;
  const insets = useSafeAreaInsets();
  
  useKeepAwake();

  const [loading, setLoading] = useState(true);
  const [htmlContent, setHtmlContent] = useState<string>("");
  const [showHeader, setShowHeader] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [volumeScrollEnabled, setVolumeScrollEnabled] = useState(true);
  const [volumeScrollSensitivity, setVolumeScrollSensitivity] = useState(50);
  const webViewRef = useRef<WebViewRef>(null);

  const calculateScrollAmount = useCallback((sensitivity: number) => {
    const minAmount = 100;
    const maxAmount = 400;
    const normalizedSensitivity = Math.max(10, Math.min(100, sensitivity));
    return minAmount + ((normalizedSensitivity - 10) / 90) * (maxAmount - minAmount);
  }, []);

  const handleVolumeScrollUp = useCallback(() => {
    const scrollAmount = calculateScrollAmount(volumeScrollSensitivity);
    webViewRef.current?.injectJavaScript(`window.scrollBy(0, -${scrollAmount}); true;`);
  }, [volumeScrollSensitivity, calculateScrollAmount]);

  const handleVolumeScrollDown = useCallback(() => {
    const scrollAmount = calculateScrollAmount(volumeScrollSensitivity);
    webViewRef.current?.injectJavaScript(`window.scrollBy(0, ${scrollAmount}); true;`);
  }, [volumeScrollSensitivity, calculateScrollAmount]);

  useVolumeScroll({
    enabled: volumeScrollEnabled,
    sensitivity: volumeScrollSensitivity,
    onScrollUp: handleVolumeScrollUp,
    onScrollDown: handleVolumeScrollDown,
  });

  useEffect(() => {
    loadChapter();
  }, [chapterId]);

  const loadChapter = async () => {
    try {
      setLoading(true);

      const [savedProgress, settings, downloadedChapter] = await Promise.all([
        storage.getReadingProgress(mangaId),
        storage.getSettings(),
        downloadManager.getDownloadedChapter(chapterId),
      ]);

      setVolumeScrollEnabled(settings.volumeScrollEnabled ?? true);
      setVolumeScrollSensitivity(settings.volumeScrollSensitivity ?? 50);

      let pageUrls: string[] = [];
      let imagesHtml = "";

      if (downloadedChapter && downloadedChapter.pages.length > 0) {
        const imagePromises = downloadedChapter.pages.map(async (pagePath, index) => {
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

        const imageResults = await Promise.all(imagePromises);
        const validImages = imageResults
          .filter(r => r.success)
          .sort((a, b) => a.index - b.index);

        imagesHtml = validImages
          .map(
            (img, idx) => `
            <div class="page" id="page-${idx}" data-page="${idx}">
              <img src="data:image/jpeg;base64,${img.base64}" alt="Page ${idx + 1}" loading="lazy" />
            </div>
          `
          )
          .join("");

        setTotalPages(validImages.length);
      } else {
        try {
          const data = await mangadexApi.getChapterPages(chapterId, settings.dataSaver);
          pageUrls = data.pages;

          imagesHtml = pageUrls
            .map(
              (url, idx) => `
              <div class="page" id="page-${idx}" data-page="${idx}">
                <img src="${url}" alt="Page ${idx + 1}" loading="lazy" />
              </div>
            `
            )
            .join("");

          setTotalPages(pageUrls.length);
        } catch (apiError) {
          console.error("API fetch failed:", apiError);
        }
      }

      const savedPage = savedProgress?.chapterId === chapterId ? savedProgress.page || 0 : 0;
      if (savedPage > 0) {
        setCurrentPage(savedPage);
      }

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0, user-scalable=yes">
            <title>${mangaTitle} - Chapter ${chapterNumber}</title>
            <script>
              var INITIAL_PAGE = ${savedPage};
            </script>
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              html, body {
                background: #000;
                color: #fff;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                overflow-x: hidden;
              }
              .container {
                width: 100%;
                min-height: 100vh;
              }
              .page {
                width: 100%;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 50vh;
                border-bottom: 1px solid #222;
              }
              .page img {
                width: 100%;
                height: auto;
                display: block;
                object-fit: contain;
              }
              .page img.loading {
                opacity: 0.5;
              }
              .loading-placeholder {
                width: 100%;
                height: 300px;
                display: flex;
                justify-content: center;
                align-items: center;
                background: #111;
              }
              .loading-text {
                color: #666;
                font-size: 14px;
              }
              .page-indicator {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: rgba(0, 0, 0, 0.8);
                color: #fff;
                padding: 8px 16px;
                border-radius: 20px;
                font-size: 14px;
                z-index: 100;
              }
            </style>
          </head>
          <body>
            <div class="container">
              ${imagesHtml}
            </div>
            <div class="page-indicator" id="pageIndicator">1 / ${totalPages}</div>
            <script>
              let currentPage = 0;
              const pages = document.querySelectorAll('.page');
              const pageIndicator = document.getElementById('pageIndicator');
              
              function updatePageIndicator() {
                let visiblePage = 0;
                const scrollY = window.scrollY || window.pageYOffset;
                const viewportHeight = window.innerHeight;
                const viewportCenter = scrollY + viewportHeight / 2;
                
                pages.forEach((page, index) => {
                  const rect = page.getBoundingClientRect();
                  const pageTop = scrollY + rect.top;
                  const pageBottom = pageTop + rect.height;
                  
                  if (viewportCenter >= pageTop && viewportCenter <= pageBottom) {
                    visiblePage = index;
                  }
                });
                
                if (visiblePage !== currentPage) {
                  currentPage = visiblePage;
                  pageIndicator.textContent = (currentPage + 1) + ' / ' + pages.length;
                  
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'pageChange',
                    page: currentPage
                  }));
                }
              }
              
              window.addEventListener('scroll', updatePageIndicator);
              
              document.querySelectorAll('img').forEach((img, index) => {
                img.addEventListener('load', function() {
                  this.classList.remove('loading');
                });
                img.addEventListener('error', function() {
                  this.alt = 'Failed to load';
                  this.style.minHeight = '200px';
                  this.style.background = '#333';
                });
              });
              
              document.addEventListener('click', function(e) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'tap'
                }));
              });
              
              function scrollToInitialPage() {
                if (INITIAL_PAGE > 0 && pages.length > INITIAL_PAGE) {
                  const targetPage = pages[INITIAL_PAGE];
                  if (targetPage) {
                    targetPage.scrollIntoView({ behavior: 'auto', block: 'start' });
                    currentPage = INITIAL_PAGE;
                    pageIndicator.textContent = (currentPage + 1) + ' / ' + pages.length;
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'pageChange',
                      page: currentPage
                    }));
                  }
                }
              }
              
              window.addEventListener('load', function() {
                setTimeout(scrollToInitialPage, 300);
              });
              
              updatePageIndicator();
            </script>
          </body>
        </html>
      `;

      setHtmlContent(html);

      await storage.markChapterAsRead(mangaId, chapterId);
    } catch (err) {
      console.error("Failed to load chapter:", err);
    } finally {
      setLoading(false);
    }
  };

  const saveProgress = useCallback(
    async (page: number) => {
      if (totalPages === 0) return;
      await storage.saveReadingProgress({
        mangaId,
        chapterId,
        chapterNumber,
        page,
        totalPages,
        updatedAt: Date.now(),
      });
    },
    [mangaId, chapterId, chapterNumber, totalPages]
  );

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "tap") {
        setShowHeader(prev => !prev);
      } else if (data.type === "pageChange") {
        setCurrentPage(data.page);
        saveProgress(data.page);
      }
    } catch (e) {
      console.error("Failed to parse WebView message:", e);
    }
  }, [saveProgress]);

  const goBack = useCallback(() => navigation.goBack(), [navigation]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color={Colors.dark.accent} />
        <ThemedText 
          type="caption" 
          lightColor="#AAA" 
          darkColor="#AAA" 
          style={styles.loadingText}
        >
          Loading {mangaTitle}...
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {showHeader && (
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + Spacing.sm,
            },
          ]}
        >
          <Pressable
            onPress={goBack}
            style={({ pressed }) => [
              styles.backButton,
              { opacity: pressed ? 0.7 : 1 },
            ]}
            hitSlop={8}
          >
            <Feather name="x" size={24} color="#FFF" />
          </Pressable>
          <View style={styles.titleContainer}>
            <ThemedText
              type="small"
              lightColor="#FFF"
              darkColor="#FFF"
              numberOfLines={1}
              style={styles.title}
            >
              {mangaTitle}
            </ThemedText>
            <ThemedText
              type="caption"
              lightColor="#AAA"
              darkColor="#AAA"
              style={styles.subtitle}
            >
              Chapter {chapterNumber} - HTML Reader
            </ThemedText>
          </View>
          <View style={styles.pageInfo}>
            <ThemedText type="caption" lightColor="#FFF" darkColor="#FFF">
              {currentPage + 1} / {totalPages}
            </ThemedText>
          </View>
        </View>
      )}

      <WebView
        ref={webViewRef}
        source={{ html: htmlContent }}
        style={styles.webview}
        originWhitelist={["*"]}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scalesPageToFit={true}
        showsVerticalScrollIndicator={true}
        showsHorizontalScrollIndicator={false}
        onMessage={handleMessage}
        mixedContentMode="always"
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    zIndex: 100,
  },
  backButton: {
    padding: Spacing.sm,
  },
  titleContainer: {
    flex: 1,
    marginHorizontal: Spacing.sm,
  },
  title: {
    fontWeight: "600",
  },
  subtitle: {
    marginTop: 2,
  },
  pageInfo: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: BorderRadius.xs,
  },
  webview: {
    flex: 1,
    backgroundColor: "#000",
  },
  loadingText: {
    marginTop: Spacing.md,
  },
});
