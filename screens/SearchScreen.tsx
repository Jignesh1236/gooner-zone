import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  TextInput,
  Dimensions,
  Pressable,
  ScrollView,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useHeaderHeight } from "@react-navigation/elements";
import { FlatList } from "react-native";
import { Feather } from "@expo/vector-icons";

import { MangaCard } from "@/components/MangaCard";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { EmptyState } from "@/components/EmptyState";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { mangadexApi, Manga } from "@/services/mangadex";
import { storage } from "@/services/storage";
import { SearchStackParamList } from "@/navigation/SearchStackNavigator";

type SearchScreenProps = {
  navigation: NativeStackNavigationProp<SearchStackParamList, "Search">;
};

const SCREEN_WIDTH = Dimensions.get("window").width;
const CARD_WIDTH = (SCREEN_WIDTH - Spacing.xl * 2 - Spacing.md) / 2;

export default function SearchScreen({ navigation }: SearchScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const headerHeight = useHeaderHeight();

  const [query, setQuery] = useState("");
  const [manga, setManga] = useState<Manga[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadRecentSearches();
  }, []);

  const loadRecentSearches = async () => {
    const searches = await storage.getRecentSearches();
    setRecentSearches(searches);
  };

  const searchManga = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setManga([]);
      setSearched(false);
      return;
    }

    try {
      setLoading(true);
      setSearched(true);

      const result = await mangadexApi.searchManga(searchQuery, 40);
      setManga(result.data);

      await storage.addRecentSearch(searchQuery);
      loadRecentSearches();
    } catch (err) {
      console.error("Error searching manga:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = (text: string) => {
    setQuery(text);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      searchManga(text);
    }, 500);
  };

  const handleClearQuery = () => {
    setQuery("");
    setManga([]);
    setSearched(false);
  };

  const handleRecentSearchPress = (search: string) => {
    setQuery(search);
    searchManga(search);
  };

  const handleClearRecentSearches = async () => {
    await storage.clearRecentSearches();
    setRecentSearches([]);
  };

  const handleMangaPress = (item: Manga) => {
    navigation.navigate("MangaDetail", { mangaId: item.id });
  };

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

  const renderRecentSearches = () => {
    if (query.trim() || recentSearches.length === 0) return null;

    return (
      <ScrollView
        style={styles.recentContainer}
        contentContainerStyle={[
          styles.recentContent,
          {
            paddingTop: headerHeight + Spacing.xl,
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
        <View
          style={[
            styles.searchBar,
            { backgroundColor: theme.backgroundDefault },
          ]}
        >
          <Feather name="search" size={20} color={theme.textSecondary} />
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="Search manga..."
            placeholderTextColor={theme.textSecondary}
            value={query}
            onChangeText={handleQueryChange}
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
      </View>

      {!query.trim() && !searched ? (
        renderRecentSearches()
      ) : loading ? (
        <LoadingIndicator fullScreen />
      ) : manga.length === 0 && searched ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            icon="search"
            title="No Results"
            message={`No manga found for "${query}"`}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: "100%",
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
});
