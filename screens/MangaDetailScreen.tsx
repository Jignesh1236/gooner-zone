import React, { useEffect, useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  ScrollView,
  Dimensions,
  FlatList,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  WithSpringConfig,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { mangadexApi, Manga, Chapter } from "@/services/mangadex";
import { storage, AppSettings } from "@/services/storage";
import { BrowseStackParamList } from "@/navigation/BrowseStackNavigator";

type MangaDetailScreenProps = {
  navigation: NativeStackNavigationProp<BrowseStackParamList, "MangaDetail">;
  route: RouteProp<BrowseStackParamList, "MangaDetail">;
};

const SCREEN_WIDTH = Dimensions.get("window").width;
const COVER_HEIGHT = 300;

const springConfig: WithSpringConfig = {
  damping: 15,
  mass: 0.3,
  stiffness: 150,
  overshootClamping: true,
  energyThreshold: 0.001,
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function MangaDetailScreen({
  navigation,
  route,
}: MangaDetailScreenProps) {
  const { mangaId } = route.params;
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [manga, setManga] = useState<Manga | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingChapters, setLoadingChapters] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [readChapters, setReadChapters] = useState<string[]>([]);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [progress, setProgress] = useState<{ chapterId: string; chapterNumber: string } | null>(null);
  const [chapterLanguage, setChapterLanguage] = useState("en");

  const buttonScale = useSharedValue(1);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setLoadingChapters(true);

      const settings = await storage.getSettings();
      const langCodes = settings.chapterLanguages && settings.chapterLanguages.length > 0
        ? settings.chapterLanguages
        : ["en"];
      setChapterLanguage(langCodes[0]);

      const [mangaData, bookmarked, readChapterIds, savedProgress] =
        await Promise.all([
          mangadexApi.getMangaDetails(mangaId),
          storage.isBookmarked(mangaId),
          storage.getReadChapters(mangaId),
          storage.getReadingProgress(mangaId),
        ]);

      setManga(mangaData);
      setIsBookmarked(bookmarked);
      setReadChapters(readChapterIds);

      if (savedProgress) {
        setProgress({
          chapterId: savedProgress.chapterId,
          chapterNumber: savedProgress.chapterNumber,
        });
      }

      let chaptersData = await mangadexApi.getChapters(mangaId, langCodes);
      
      if (chaptersData.length === 0) {
        const fallbackLangs = ["en", "ko", "ja", "zh", "es", "pt-br", "fr", "de", "ru"];
        chaptersData = await mangadexApi.getChapters(mangaId, fallbackLangs);
        if (chaptersData.length > 0) {
          setChapterLanguage("multi");
        }
      }

      setChapters(chaptersData);
    } catch (err) {
      console.error("Error fetching manga details:", err);
    } finally {
      setLoading(false);
      setLoadingChapters(false);
    }
  }, [mangaId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleBookmarkPress = async () => {
    if (!manga) return;

    if (isBookmarked) {
      await storage.removeBookmark(mangaId);
      setIsBookmarked(false);
    } else {
      await storage.addBookmark(manga);
      setIsBookmarked(true);
    }
  };

  const handleChapterPress = async (chapter: Chapter) => {
    if (!manga) return;

    await storage.addToHistory(manga, chapter.id, chapter.chapter);

    navigation.navigate("ChapterReader", {
      chapterId: chapter.id,
      mangaId: manga.id,
      mangaTitle: manga.title,
    });
  };

  const handleStartReading = () => {
    if (!manga || chapters.length === 0) return;

    if (progress) {
      const chapterToResume = chapters.find((c) => c.id === progress.chapterId);
      if (chapterToResume) {
        handleChapterPress(chapterToResume);
        return;
      }
    }

    const firstUnread = chapters.find((c) => !readChapters.includes(c.id));
    handleChapterPress(firstUnread || chapters[0]);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  if (loading || !manga) {
    return <LoadingIndicator fullScreen />;
  }

  const accentColor = isDark ? Colors.dark.accent : Colors.light.accent;
  const hasProgress = progress !== null;
  const buttonText = hasProgress
    ? `Continue Ch. ${progress.chapterNumber}`
    : "Start Reading";

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.coverContainer}>
          {manga.coverUrl ? (
            <>
              <Image
                source={{ uri: manga.coverUrl }}
                style={styles.coverBackground}
                contentFit="cover"
                blurRadius={20}
              />
              <LinearGradient
                colors={["transparent", theme.backgroundRoot]}
                style={styles.coverGradient}
              />
              <Image
                source={{ uri: manga.coverUrl }}
                style={styles.coverImage}
                contentFit="cover"
                transition={200}
              />
            </>
          ) : (
            <View
              style={[
                styles.placeholderCover,
                { backgroundColor: theme.backgroundSecondary },
              ]}
            >
              <Feather name="book" size={60} color={theme.textSecondary} />
            </View>
          )}
        </View>

        <View style={styles.contentContainer}>
          <View style={styles.headerRow}>
            <View style={styles.titleContainer}>
              <ThemedText type="h3" style={styles.title} numberOfLines={3}>
                {manga.title}
              </ThemedText>
              <ThemedText
                type="small"
                style={[styles.author, { color: theme.textSecondary }]}
              >
                {manga.author}
              </ThemedText>
            </View>
            <Pressable
              onPress={handleBookmarkPress}
              style={({ pressed }) => [
                styles.bookmarkButton,
                {
                  backgroundColor: theme.backgroundDefault,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Feather
                name="bookmark"
                size={24}
                color={isBookmarked ? theme.primary : theme.text}
                style={isBookmarked ? { opacity: 1 } : { opacity: 0.6 }}
              />
            </Pressable>
          </View>

          <View style={styles.metaRow}>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: theme.backgroundDefault },
              ]}
            >
              <ThemedText type="caption" style={{ color: theme.text }}>
                {manga.status.charAt(0).toUpperCase() + manga.status.slice(1)}
              </ThemedText>
            </View>
            {manga.year ? (
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: theme.backgroundDefault },
                ]}
              >
                <ThemedText type="caption" style={{ color: theme.text }}>
                  {manga.year}
                </ThemedText>
              </View>
            ) : null}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tagsScroll}
            contentContainerStyle={styles.tagsContent}
          >
            {manga.tags.slice(0, 8).map((tag, index) => (
              <View
                key={index}
                style={[
                  styles.tag,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
              >
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary }}
                >
                  {tag}
                </ThemedText>
              </View>
            ))}
          </ScrollView>

          <Pressable onPress={() => setShowFullDescription(!showFullDescription)}>
            <ThemedText
              type="body"
              style={[styles.description, { color: theme.textSecondary }]}
              numberOfLines={showFullDescription ? undefined : 4}
            >
              {manga.description}
            </ThemedText>
            {manga.description.length > 200 ? (
              <ThemedText type="small" style={{ color: theme.primary }}>
                {showFullDescription ? "Show less" : "Read more"}
              </ThemedText>
            ) : null}
          </Pressable>

          <View style={styles.chaptersSection}>
            <View style={styles.chapterHeader}>
              <ThemedText type="h4">Chapters</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {chapters.length} chapters
              </ThemedText>
            </View>

            {loadingChapters ? (
              <LoadingIndicator />
            ) : chapters.length === 0 ? (
              <View style={styles.noChapters}>
                <ThemedText
                  type="body"
                  style={{ color: theme.textSecondary, textAlign: "center" }}
                >
                  No chapters available in this language
                </ThemedText>
              </View>
            ) : (
              chapters.map((chapter) => {
                const isRead = readChapters.includes(chapter.id);
                return (
                  <Pressable
                    key={chapter.id}
                    onPress={() => handleChapterPress(chapter)}
                    style={({ pressed }) => [
                      styles.chapterItem,
                      {
                        backgroundColor: theme.backgroundDefault,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <View style={styles.chapterInfo}>
                      <View style={styles.chapterTitleRow}>
                        {!isRead ? (
                          <View
                            style={[
                              styles.unreadDot,
                              { backgroundColor: theme.primary },
                            ]}
                          />
                        ) : null}
                        <ThemedText
                          type="body"
                          style={[
                            styles.chapterTitle,
                            isRead && { opacity: 0.6 },
                          ]}
                          numberOfLines={1}
                        >
                          Ch. {chapter.chapter}
                          {chapter.title ? ` - ${chapter.title}` : ""}
                        </ThemedText>
                      </View>
                      <ThemedText
                        type="caption"
                        style={{ color: theme.textSecondary }}
                      >
                        {formatDate(chapter.publishedAt)}
                      </ThemedText>
                    </View>
                    <Feather
                      name="chevron-right"
                      size={20}
                      color={theme.textSecondary}
                    />
                  </Pressable>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      {chapters.length > 0 ? (
        <View
          style={[
            styles.bottomBar,
            {
              paddingBottom: insets.bottom + Spacing.md,
              backgroundColor: theme.backgroundRoot,
            },
          ]}
        >
          <AnimatedPressable
            onPress={handleStartReading}
            onPressIn={() => {
              buttonScale.value = withSpring(0.95, springConfig);
            }}
            onPressOut={() => {
              buttonScale.value = withSpring(1, springConfig);
            }}
            style={[
              styles.startButton,
              { backgroundColor: accentColor },
              animatedButtonStyle,
            ]}
          >
            <Feather name="book-open" size={20} color="#FFFFFF" />
            <ThemedText
              type="body"
              style={styles.startButtonText}
              lightColor="#FFFFFF"
              darkColor="#FFFFFF"
            >
              {buttonText}
            </ThemedText>
          </AnimatedPressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  coverContainer: {
    height: COVER_HEIGHT,
    position: "relative",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  coverBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  coverGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  coverImage: {
    width: 140,
    height: 200,
    borderRadius: BorderRadius.xs,
    marginBottom: -60,
  },
  placeholderCover: {
    width: 140,
    height: 200,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: -60,
  },
  contentContainer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: 70,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    marginBottom: Spacing.xs,
  },
  author: {},
  bookmarkButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  metaRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  tagsScroll: {
    marginTop: Spacing.md,
    marginHorizontal: -Spacing.xl,
  },
  tagsContent: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  tag: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  description: {
    marginTop: Spacing.lg,
  },
  chaptersSection: {
    marginTop: Spacing["2xl"],
  },
  chapterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  noChapters: {
    padding: Spacing.xl,
  },
  chapterItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
    marginBottom: Spacing.sm,
  },
  chapterInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  chapterTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  chapterTitle: {
    fontWeight: "600",
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  startButtonText: {
    fontWeight: "700",
  },
});
