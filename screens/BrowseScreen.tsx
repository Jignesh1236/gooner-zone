import React, { useEffect, useState, useCallback } from "react";
import { StyleSheet, View, Dimensions, RefreshControl, Platform } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useHeaderHeight } from "@react-navigation/elements";
import { FlatList } from "react-native";

import { MangaCard } from "@/components/MangaCard";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { EmptyState } from "@/components/EmptyState";
import { ContinueReadingButton } from "@/components/ContinueReadingButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { mangadexApi, Manga } from "@/services/mangadex";
import { BrowseStackParamList } from "@/navigation/BrowseStackNavigator";

type BrowseScreenProps = {
  navigation: NativeStackNavigationProp<BrowseStackParamList, "Browse">;
};

const SCREEN_WIDTH = Dimensions.get("window").width;
const CARD_WIDTH = (SCREEN_WIDTH - Spacing.xl * 2 - Spacing.md) / 2;
const IS_WEB = Platform.OS === "web";

export default function BrowseScreen({ navigation }: BrowseScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const headerHeight = useHeaderHeight();

  const [manga, setManga] = useState<Manga[]>([]);
  const [loading, setLoading] = useState(!IS_WEB);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(IS_WEB ? "web" : null);

  const fetchManga = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        setError(null);

        const result = await mangadexApi.getPopularManga(20);
        setManga(result.data);
      } catch (err) {
        setError("Failed to load manga. Please try again.");
        console.error("Error fetching manga:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!IS_WEB) {
      fetchManga();
    }
  }, []);

  const handleRefresh = () => {
    fetchManga(true);
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

  if (loading) {
    return <LoadingIndicator fullScreen />;
  }

  if (error && manga.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <EmptyState
          icon={IS_WEB ? "smartphone" : "wifi-off"}
          title={IS_WEB ? "Use Expo Go for Full Experience" : "Connection Error"}
          message={IS_WEB 
            ? "The MangaDex API doesn't work in web browsers due to security restrictions. Scan the QR code in the URL bar to open in Expo Go on your phone for full manga browsing." 
            : error || "Failed to load manga. Please try again."}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={manga}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: headerHeight + Spacing.xl,
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
            title="No Manga Found"
            message="Check back later for new content"
          />
        }
      />
      <ContinueReadingButton />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
