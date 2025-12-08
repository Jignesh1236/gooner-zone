import React from "react";
import { StyleSheet, Pressable, View, Dimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  WithSpringConfig,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";
import { Manga } from "@/services/mangadex";

interface MangaCardProps {
  manga: Manga;
  onPress: () => void;
  width?: number;
}

const springConfig: WithSpringConfig = {
  damping: 15,
  mass: 0.3,
  stiffness: 150,
  overshootClamping: true,
  energyThreshold: 0.001,
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SCREEN_WIDTH = Dimensions.get("window").width;
const DEFAULT_CARD_WIDTH = (SCREEN_WIDTH - Spacing.xl * 2 - Spacing.md) / 2;

export function MangaCard({
  manga,
  onPress,
  width = DEFAULT_CARD_WIDTH,
}: MangaCardProps) {
  const { theme, isDark } = useTheme();
  const scale = useSharedValue(1);

  const cardHeight = width * 1.5;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, springConfig);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, springConfig);
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.card,
        {
          width,
          height: cardHeight,
          borderColor: isDark ? "transparent" : theme.cardBorder,
        },
        animatedStyle,
      ]}
    >
      {manga.coverUrl ? (
        <Image
          source={{ uri: manga.coverUrl }}
          style={styles.coverImage}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View
          style={[styles.placeholder, { backgroundColor: theme.backgroundSecondary }]}
        >
          <Feather name="book" size={40} color={theme.textSecondary} />
        </View>
      )}

      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.8)"]}
        style={styles.gradient}
      >
        <ThemedText
          type="small"
          style={styles.title}
          numberOfLines={2}
          lightColor="#FFFFFF"
          darkColor="#FFFFFF"
        >
          {manga.title}
        </ThemedText>
      </LinearGradient>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.xs,
    overflow: "hidden",
    borderWidth: 1,
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  gradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingTop: Spacing["2xl"],
  },
  title: {
    fontWeight: "600",
  },
});
