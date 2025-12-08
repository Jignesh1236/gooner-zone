import React, { useEffect, useState, useCallback } from "react";
import { StyleSheet, View, Dimensions, RefreshControl, Platform, FlatList, Pressable } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useHeaderHeight } from "@react-navigation/elements";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { MangaCard } from "@/components/MangaCard";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { EmptyState } from "@/components/EmptyState";
import { ContinueReadingButton } from "@/components/ContinueReadingButton";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { Feather } from "@expo/vector-icons";
import { mangadexApi, Manga, SearchFilters } from "@/services/mangadex";
import { storage } from "@/services/storage";
import { BrowseStackParamList } from "@/navigation/BrowseStackNavigator";
import { useFocusEffect } from "@react-navigation/native";
import { SearchFiltersModal } from "@/components/SearchFiltersModal";

type BrowseScreenProps = {
  navigation: NativeStackNavigationProp<BrowseStackParamList, "Browse">;
};

type TabType = "manga" | "manhwa";

const SCREEN_WIDTH = Dimensions.get("window").width;
const CARD_WIDTH = (SCREEN_WIDTH - Spacing.xl * 2 - Spacing.md) / 2;
const TAB_WIDTH = (SCREEN_WIDTH - Spacing.xl * 2) / 2;
const IS_WEB = Platform.OS === "web";

export default function BrowseScreen({ navigation }: BrowseScreenProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const headerHeight = useHeaderHeight();

  const [activeTab, setActiveTab] = useState<TabType>("manga");
  const [mangaList, setMangaList] = useState<Manga[]>([]);
  const [manhwaList, setManhwaList] = useState<Manga[]>([]);
  const [combinedList, setCombinedList] = useState<Manga[]>([]);
  const [loading, setLoading] = useState(!IS_WEB);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(IS_WEB ? "web" : null);
  const [adultMode, setAdultMode] = useState(false);
  const [languages, setLanguages] = useState<string[]>(["en", "ja"]);
  const [filters, setFilters] = useState<SearchFilters>({
    includedTags: [],
    excludedTags: [],
    status: [],
    sortBy: "followedCount",
  });
  const [showFilters, setShowFilters] = useState(false);

  const indicatorPosition = useSharedValue(0);

  const animatedIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorPosition.value }],
  }));

  const handleTabPress = (tab: TabType) => {
    setActiveTab(tab);
    indicatorPosition.value = withSpring(tab === "manga" ? 0 : TAB_WIDTH, {
      damping: 20,
      stiffness: 200,
    });
  };

  const hasActiveFilters = filters.includedTags.length > 0 || filters.excludedTags.length > 0 || filters.status.length > 0 || filters.sortBy !== "followedCount";

  const fetchAllData = useCallback(
    async (isRefresh = false, isAdultMode = false, langs: string[] = ["en", "ja"], searchFilters?: SearchFilters) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        setError(null);

        const hasFilters = searchFilters && (searchFilters.includedTags.length > 0 || searchFilters.excludedTags.length > 0 || searchFilters.status.length > 0 || searchFilters.sortBy !== "followedCount");

        const [mangaResult, manhwaResult] = await Promise.all([
          mangadexApi.getManga(40, isAdultMode, langs),
          mangadexApi.getManhwa(40, isAdultMode, langs),
        ]);

        setMangaList(mangaResult.data);
        setManhwaList(manhwaResult.data);
        
        if (hasFilters) {
          const combined = [...mangaResult.data, ...manhwaResult.data].sort(() => Math.random() - 0.5);
          setCombinedList(combined);
        }
      } catch (err) {
        setError("Failed to load content. Please try again.");
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      const loadSettings = async () => {
        const settings = await storage.getSettings();
        const settingsChanged = settings.adultMode !== adultMode || 
          JSON.stringify(settings.chapterLanguages) !== JSON.stringify(languages);
        if (settingsChanged) {
          setAdultMode(settings.adultMode);
          setLanguages(settings.chapterLanguages);
          if (!IS_WEB) {
            fetchAllData(false, settings.adultMode, settings.chapterLanguages);
          }
        }
      };
      loadSettings();
    }, [adultMode, languages])
  );

  useEffect(() => {
    if (!IS_WEB) {
      const loadInitialData = async () => {
        const settings = await storage.getSettings();
        setAdultMode(settings.adultMode);
        setLanguages(settings.chapterLanguages);
        fetchAllData(false, settings.adultMode, settings.chapterLanguages);
      };
      loadInitialData();
    }
  }, []);

  const handleRefresh = () => {
    fetchAllData(true, adultMode, languages, filters);
  };

  const handleApplyFilters = (newFilters: SearchFilters) => {
    setFilters(newFilters);
    fetchAllData(false, adultMode, languages, newFilters);
  };

  const handleMangaPress = (item: Manga) => {
    navigation.navigate("MangaDetail", { mangaId: item.id });
  };

  const renderGridItem = ({ item, index }: { item: Manga; index: number }) => (
    <View
      style={[
        styles.cardContainer,
        index % 2 === 0 ? styles.cardLeft : styles.cardRight,
      ]}
    >
      <MangaCard
        manga={item}
        onPress={() => handleMangaPress(item)}
        width={CARD_WIDTH}
      />
    </View>
  );

  const activeFiltersCount = (filters.includedTags.length + filters.excludedTags.length + filters.status.length);

  const renderListHeader = () => (
    <View style={styles.headerContainer}>
      {!hasActiveFilters && (
        <View style={[styles.tabContainer, { backgroundColor: theme.backgroundSecondary }]}>
          <Animated.View 
            style={[
              styles.tabIndicator, 
              { backgroundColor: theme.primary },
              animatedIndicatorStyle
            ]} 
          />
          <Pressable 
            style={styles.tab} 
            onPress={() => handleTabPress("manga")}
          >
            <ThemedText 
              type="body" 
              style={[
                styles.tabText,
                { color: activeTab === "manga" ? "#FFFFFF" : theme.textSecondary }
              ]}
            >
              Manga
            </ThemedText>
          </Pressable>
          <Pressable 
            style={styles.tab} 
            onPress={() => handleTabPress("manhwa")}
          >
            <ThemedText 
              type="body" 
              style={[
                styles.tabText,
                { color: activeTab === "manhwa" ? "#FFFFFF" : theme.textSecondary }
              ]}
            >
              Manhwa
            </ThemedText>
          </Pressable>
        </View>
      )}
      {hasActiveFilters && (
        <ThemedText type="body" style={{ color: theme.textSecondary, fontSize: 14, marginBottom: Spacing.sm }}>
          Combined Results ({combinedList.length})
        </ThemedText>
      )}
      <Pressable
        onPress={() => setShowFilters(true)}
        style={({ pressed }) => [
          styles.filterButton,
          { 
            backgroundColor: activeFiltersCount > 0 ? theme.primary : theme.backgroundDefault,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Feather 
          name="sliders" 
          size={20} 
          color={activeFiltersCount > 0 ? "#FFFFFF" : theme.textSecondary} 
        />
        {activeFiltersCount > 0 && (
          <View style={[styles.filterBadge, { backgroundColor: "#FFFFFF" }]}>
            <ThemedText type="caption" style={{ color: theme.primary, fontSize: 10 }}>
              {activeFiltersCount}
            </ThemedText>
          </View>
        )}
      </Pressable>
    </View>
  );

  const currentList = hasActiveFilters ? combinedList : (activeTab === "manga" ? mangaList : manhwaList);

  if (loading) {
    return <LoadingIndicator fullScreen />;
  }

  if (error && mangaList.length === 0 && manhwaList.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <EmptyState
          icon={IS_WEB ? "smartphone" : "wifi-off"}
          title={IS_WEB ? "Use Expo Go for Full Experience" : "Connection Error"}
          message={IS_WEB 
            ? "The MangaDex API doesn't work in web browsers due to security restrictions. Scan the QR code in the URL bar to open in Expo Go on your phone for full manga browsing." 
            : error || "Failed to load content. Please try again."}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={currentList}
        renderItem={renderGridItem}
        keyExtractor={(item) => `${activeTab}-${item.id}`}
        numColumns={2}
        ListHeaderComponent={renderListHeader}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: headerHeight + Spacing.md,
            paddingBottom: tabBarHeight + Spacing.xl + 80,
          },
        ]}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
            progressViewOffset={headerHeight}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="book"
            title={`No ${activeTab === "manga" ? "Manga" : "Manhwa"} Found`}
            message="No content found for selected language"
          />
        }
      />
      <ContinueReadingButton />
      
      <SearchFiltersModal
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        onApply={handleApplyFilters}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    gap: Spacing.md,
  },
  tabContainer: {
    height: 48,
    borderRadius: BorderRadius.lg,
    flexDirection: "row",
    overflow: "hidden",
  },
  filterButton: {
    height: 48,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  filterBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  tabIndicator: {
    position: "absolute",
    width: TAB_WIDTH,
    height: "100%",
    borderRadius: BorderRadius.lg,
  },
  tab: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  tabText: {
    fontWeight: "600",
    fontSize: 16,
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
  },
  row: {
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  cardContainer: {
    width: CARD_WIDTH,
  },
  cardLeft: {},
  cardRight: {},
});
