import React from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { Manga } from "@/services/mangadex";

interface SimilarMangaSectionProps {
  manga: Manga[];
  loading: boolean;
  onMangaPress: (manga: Manga) => void;
}

const CARD_WIDTH = 120;
const CARD_HEIGHT = 170;

export function SimilarMangaSection({
  manga,
  loading,
  onMangaPress,
}: SimilarMangaSectionProps) {
  const { theme } = useTheme();

  if (loading) {
    return (
      <View style={styles.container}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          Agar yeh pasand aaya toh...
        </ThemedText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {[1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={[
                styles.skeletonCard,
                { backgroundColor: theme.backgroundSecondary },
              ]}
            />
          ))}
        </ScrollView>
      </View>
    );
  }

  if (manga.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ThemedText type="h4" style={styles.sectionTitle}>
        Agar yeh pasand aaya toh...
      </ThemedText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {manga.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => onMangaPress(item)}
            style={({ pressed }) => [
              styles.card,
              { opacity: pressed ? 0.8 : 1 },
            ]}
          >
            {item.coverUrl ? (
              <Image
                source={{ uri: item.coverUrl }}
                style={[
                  styles.coverImage,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View
                style={[
                  styles.placeholderCover,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
              >
                <Feather name="book" size={30} color={theme.textSecondary} />
              </View>
            )}
            <ThemedText
              type="caption"
              style={styles.title}
              numberOfLines={2}
            >
              {item.title}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing["2xl"],
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  scrollContent: {
    gap: Spacing.md,
    paddingRight: Spacing.xl,
  },
  card: {
    width: CARD_WIDTH,
  },
  coverImage: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: BorderRadius.xs,
  },
  placeholderCover: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    marginTop: Spacing.xs,
  },
  skeletonCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: BorderRadius.xs,
  },
});
