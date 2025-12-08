import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  TextInput,
  Dimensions,
  Pressable,
  ScrollView,
  Platform,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useHeaderHeight } from "@react-navigation/elements";
import { FlatList } from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

import { useFocusEffect } from "@react-navigation/native";

import { MangaCard } from "@/components/MangaCard";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { EmptyState } from "@/components/EmptyState";
import { ThemedText } from "@/components/ThemedText";
import { SearchFiltersModal } from "@/components/SearchFiltersModal";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { mangadexApi, Manga, SearchFilters } from "@/services/mangadex";
import { storage } from "@/services/storage";
import { SearchStackParamList } from "@/navigation/SearchStackNavigator";

type SearchScreenProps = {
  navigation: NativeStackNavigationProp<SearchStackParamList, "Search">;
};

type SearchTab = "all" | "manga" | "manhwa";

const SCREEN_WIDTH = Dimensions.get("window").width;
const CARD_WIDTH = (SCREEN_WIDTH - Spacing.xl * 2 - Spacing.md) / 2;
const TAB_WIDTH = (SCREEN_WIDTH - Spacing.xl * 2) / 3;
const IS_WEB = Platform.OS === "web";

export default function SearchScreen({ navigation }: SearchScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const headerHeight = useHeaderHeight();

  const [query, setQuery] = useState("");
  const [manga, setManga] = useState<Manga[]>([]);
  const [suggestions, setSuggestions] = useState<Manga[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [searched, setSearched] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [adultMode, setAdultMode] = useState(false);
  const [languages, setLanguages] = useState<string[]>(["en", "ja"]);
  const [activeTab, setActiveTab] = useState<SearchTab>("all");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    includedTags: [],
    excludedTags: [],
    status: [],
    sortBy: "relevance",
  });

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const suggestionRef = useRef<NodeJS.Timeout | null>(null);
  const indicatorPosition = useSharedValue(0);

  const activeFiltersCount = 
    filters.includedTags.length + 
    filters.excludedTags.length + 
    filters.status.length;

  useEffect(() => {
    loadRecentSearches();
    loadSettings();
  }, []);

  useFocusEffect(
    useCallback(() => {
      const checkSettings = async () => {
        const settings = await storage.getSettings();
        setAdultMode(settings.adultMode);
        setLanguages(settings.chapterLanguages);
      };
      checkSettings();
    }, [])
  );

  const loadSettings = async () => {
    const settings = await storage.getSettings();
    setAdultMode(settings.adultMode);
    setLanguages(settings.chapterLanguages);
  };

  const loadRecentSearches = async () => {
    const searches = await storage.getRecentSearches();
    setRecentSearches(searches);
  };

  const getLanguageFilter = (tab: SearchTab) => {
    switch (tab) {
      case "manga":
        return "ja";
      case "manhwa":
        return "ko";
      default:
        return undefined;
    }
  };

  const searchManga = useCallback(async (
    searchQuery: string, 
    isAdultMode: boolean, 
    langs: string[] = ["en", "ja"],
    tab: SearchTab = "all",
    searchFilters?: SearchFilters
  ) => {
    if (IS_WEB) return;
    
    const hasFilters = searchFilters && (
      searchFilters.includedTags.length > 0 ||
      searchFilters.excludedTags.length > 0 ||
      searchFilters.status.length > 0 ||
      searchFilters.sortBy !== "relevance"
    );
    
    if (!searchQuery.trim() && !hasFilters) {
      setManga([]);
      setSearched(false);
      return;
    }

    try {
      setLoading(true);
      setSearched(true);
      setShowSuggestions(false);

      const originalLanguage = getLanguageFilter(tab);
      const result = await mangadexApi.searchManga(searchQuery, 40, { 
        adultMode: isAdultMode, 
        languages: langs,
        originalLanguage,
        filters: searchFilters,
      });
      setManga(result.data);

      if (searchQuery.trim()) {
        await storage.addRecentSearch(searchQuery);
        loadRecentSearches();
      }
    } catch (err) {
      console.error("Error searching manga:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSuggestions = useCallback(async (
    searchQuery: string, 
    isAdultMode: boolean, 
    langs: string[] = ["en", "ja"],
    tab: SearchTab = "all"
  ) => {
    if (IS_WEB) return;
    
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      setLoadingSuggestions(true);
      const originalLanguage = getLanguageFilter(tab);
      const result = await mangadexApi.searchManga(searchQuery, 5, { 
        adultMode: isAdultMode, 
        languages: langs,
        originalLanguage,
      });
      setSuggestions(result.data);
      setShowSuggestions(true);
    } catch (err) {
      console.error("Error fetching suggestions:", err);
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    setSearched(false);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (suggestionRef.current) {
      clearTimeout(suggestionRef.current);
    }

    if (text.length >= 2) {
      suggestionRef.current = setTimeout(() => {
        fetchSuggestions(text, adultMode, languages, activeTab);
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSearch = () => {
    setShowSuggestions(false);
    searchManga(query, adultMode, languages, activeTab, filters);
  };

  const handleApplyFilters = (newFilters: SearchFilters) => {
    setFilters(newFilters);
    if (query.trim() || 
        newFilters.includedTags.length > 0 || 
        newFilters.excludedTags.length > 0 ||
        newFilters.status.length > 0) {
      searchManga(query, adultMode, languages, activeTab, newFilters);
    }
  };

  const handleSuggestionPress = (item: Manga) => {
    setShowSuggestions(false);
    navigation.navigate("MangaDetail", { mangaId: item.id });
  };

  const handleClearQuery = () => {
    setQuery("");
    setManga([]);
    setSuggestions([]);
    setSearched(false);
    setShowSuggestions(false);
  };

  const handleRecentSearchPress = (search: string) => {
    setQuery(search);
    searchManga(search, adultMode, languages, activeTab);
  };

  const handleClearRecentSearches = async () => {
    await storage.clearRecentSearches();
    setRecentSearches([]);
  };

  const handleMangaPress = (item: Manga) => {
    navigation.navigate("MangaDetail", { mangaId: item.id });
  };

  const handleTabChange = (tab: SearchTab) => {
    const tabIndex = tab === "all" ? 0 : tab === "manga" ? 1 : 2;
    indicatorPosition.value = withTiming(tabIndex * TAB_WIDTH, { duration: 200 });
    setActiveTab(tab);
    
    if (query.trim() && searched) {
      searchManga(query, adultMode, languages, tab);
    } else if (query.trim() && showSuggestions) {
      fetchSuggestions(query, adultMode, languages, tab);
    }
  };

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorPosition.value }],
  }));

  const renderItem = ({ item, index }: { item: Manga; index: number }) => (
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

  const renderSuggestions = () => {
    if (!showSuggestions || suggestions.length === 0) return null;

    return (
      <View style={[styles.suggestionsContainer, { backgroundColor: theme.backgroundDefault }]}>
        <View style={styles.suggestionsHeader}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Suggestions
          </ThemedText>
          {loadingSuggestions && (
            <ThemedText type="small" style={{ color: theme.primary }}>
              Loading...
            </ThemedText>
          )}
        </View>
        {suggestions.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => handleSuggestionPress(item)}
            style={({ pressed }) => [
              styles.suggestionItem,
              {
                backgroundColor: pressed ? theme.backgroundRoot : "transparent",
              },
            ]}
          >
            <Feather name="book-open" size={16} color={theme.primary} />
            <View style={styles.suggestionTextContainer}>
              <ThemedText type="body" numberOfLines={1} style={styles.suggestionTitle}>
                {item.title}
              </ThemedText>
              {item.type && (
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {item.type}
                </ThemedText>
              )}
            </View>
            <Feather name="arrow-up-right" size={16} color={theme.textSecondary} />
          </Pressable>
        ))}
        <Pressable
          onPress={handleSearch}
          style={({ pressed }) => [
            styles.searchAllButton,
            {
              backgroundColor: theme.primary,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Feather name="search" size={16} color="#fff" />
          <ThemedText type="body" style={{ color: "#fff" }}>
            Search all for "{query}"
          </ThemedText>
        </Pressable>
      </View>
    );
  };

  const renderRecentSearches = () => {
    if (query.trim() || recentSearches.length === 0) return null;

    return (
      <ScrollView
        style={styles.recentContainer}
        contentContainerStyle={[
          styles.recentContent,
          {
            paddingTop: Spacing.md,
            paddingBottom: tabBarHeight + Spacing.xl,
          },
        ]}
      >
        <View style={styles.recentHeader}>
          <ThemedText type="h4">Recent Searches</ThemedText>
          <Pressable
            onPress={handleClearRecentSearches}
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
          >
            <ThemedText type="small" style={{ color: theme.primary }}>
              Clear All
            </ThemedText>
          </Pressable>
        </View>
        {recentSearches.map((search, index) => (
          <Pressable
            key={index}
            onPress={() => handleRecentSearchPress(search)}
            style={({ pressed }) => [
              styles.recentItem,
              {
                backgroundColor: theme.backgroundDefault,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Feather name="clock" size={18} color={theme.textSecondary} />
            <ThemedText type="body" style={styles.recentText}>
              {search}
            </ThemedText>
            <Feather name="arrow-up-left" size={18} color={theme.textSecondary} />
          </Pressable>
        ))}
      </ScrollView>
    );
  };

  const renderTabs = () => (
    <View style={styles.tabContainer}>
      <View style={[styles.tabBar, { backgroundColor: theme.backgroundDefault }]}>
        <Animated.View
          style={[
            styles.tabIndicator,
            { backgroundColor: theme.primary },
            indicatorStyle,
          ]}
        />
        {(["all", "manga", "manhwa"] as SearchTab[]).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => handleTabChange(tab)}
            style={styles.tab}
          >
            <ThemedText
              type="body"
              style={[
                styles.tabText,
                {
                  color: activeTab === tab ? theme.primary : theme.textSecondary,
                  fontWeight: activeTab === tab ? "600" : "400",
                },
              ]}
            >
              {tab === "all" ? "All" : tab === "manga" ? "Manga" : "Manhwa"}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </View>
  );

  if (IS_WEB) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <EmptyState
          icon="smartphone"
          title="Use Expo Go for Full Experience"
          message="The MangaDex API doesn't work in web browsers due to security restrictions. Scan the QR code in the URL bar to open in Expo Go on your phone for full search functionality."
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View
        style={[
          styles.searchContainer,
          {
            paddingTop: headerHeight + Spacing.md,
            backgroundColor: theme.backgroundRoot,
          },
        ]}
      >
        <View style={styles.searchRow}>
          <View
            style={[
              styles.searchBar,
              { backgroundColor: theme.backgroundDefault },
            ]}
          >
            <Feather name="search" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="Search manga, manhwa..."
              placeholderTextColor={theme.textSecondary}
              value={query}
              onChangeText={handleQueryChange}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {query.length > 0 ? (
              <Pressable
                onPress={handleClearQuery}
                style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
              >
                <Feather name="x-circle" size={20} color={theme.textSecondary} />
              </Pressable>
            ) : null}
          </View>
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
        {renderTabs()}
      </View>

      {showSuggestions && query.trim() && !searched ? (
        <ScrollView 
          style={styles.suggestionsScrollView}
          contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.xl }}
          keyboardShouldPersistTaps="handled"
        >
          {renderSuggestions()}
        </ScrollView>
      ) : !query.trim() && !searched ? (
        renderRecentSearches()
      ) : loading ? (
        <LoadingIndicator fullScreen />
      ) : manga.length === 0 && searched ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            icon="search"
            title="No Results"
            message={`No ${activeTab === "all" ? "manga/manhwa" : activeTab} found for "${query}"`}
          />
        </View>
      ) : (
        <FlatList
          data={manga}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={[
            styles.listContent,
            {
              paddingBottom: tabBarHeight + Spacing.xl,
            },
          ]}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
        />
      )}

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
  searchContainer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  searchRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  filterButton: {
    width: Spacing.inputHeight,
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
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
  input: {
    flex: 1,
    fontSize: 16,
    height: "100%",
  },
  tabContainer: {
    marginTop: Spacing.md,
  },
  tabBar: {
    flexDirection: "row",
    borderRadius: BorderRadius.sm,
    position: "relative",
    overflow: "hidden",
  },
  tab: {
    width: TAB_WIDTH,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  tabText: {
    fontSize: 14,
  },
  tabIndicator: {
    position: "absolute",
    width: TAB_WIDTH,
    height: "100%",
    borderRadius: BorderRadius.sm,
    opacity: 0.15,
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
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
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  recentContainer: {
    flex: 1,
  },
  recentContent: {
    paddingHorizontal: Spacing.xl,
  },
  recentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  recentItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  recentText: {
    flex: 1,
  },
  suggestionsScrollView: {
    flex: 1,
  },
  suggestionsContainer: {
    marginHorizontal: Spacing.xl,
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
  },
  suggestionsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  suggestionTextContainer: {
    flex: 1,
  },
  suggestionTitle: {
    marginBottom: 2,
  },
  searchAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    gap: Spacing.sm,
    margin: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
});
