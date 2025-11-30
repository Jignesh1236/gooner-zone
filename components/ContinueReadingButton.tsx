import React, { useEffect, useState } from "react";
import { StyleSheet, Pressable, View, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  WithSpringConfig,
} from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing, Colors } from "@/constants/theme";
import { storage, ReadingHistoryItem } from "@/services/storage";

const springConfig: WithSpringConfig = {
  damping: 15,
  mass: 0.3,
  stiffness: 150,
  overshootClamping: true,
  energyThreshold: 0.001,
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function ContinueReadingButton() {
  const { theme, isDark } = useTheme();
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const scale = useSharedValue(1);

  const [lastRead, setLastRead] = useState<ReadingHistoryItem | null>(null);

  useEffect(() => {
    const loadLastRead = async () => {
      const data = await storage.getLastRead();
      setLastRead(data);
    };

    loadLastRead();

    const unsubscribe = navigation.addListener("focus", loadLastRead);
    return unsubscribe;
  }, [navigation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.9, springConfig);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, springConfig);
  };

  const handlePress = () => {
    if (lastRead) {
      navigation.navigate("ChapterReader", {
        chapterId: lastRead.lastChapterId,
        mangaId: lastRead.manga.id,
        mangaTitle: lastRead.manga.title,
      });
    }
  };

  if (!lastRead) return null;

  const bottomPosition = tabBarHeight + Spacing.lg;
  const accentColor = isDark ? Colors.dark.accent : Colors.light.accent;

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.button,
        {
          backgroundColor: accentColor,
          bottom: bottomPosition,
        },
        animatedStyle,
      ]}
    >
      <View style={styles.content}>
        <Feather name="book-open" size={24} color="#FFFFFF" />
        <View style={styles.textContainer}>
          <ThemedText
            type="caption"
            style={styles.label}
            lightColor="#FFFFFF"
            darkColor="#FFFFFF"
          >
            Continue
          </ThemedText>
          <ThemedText
            type="small"
            style={styles.title}
            numberOfLines={1}
            lightColor="#FFFFFF"
            darkColor="#FFFFFF"
          >
            Ch. {lastRead.lastChapterNumber}
          </ThemedText>
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    right: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 5,
      },
      web: {
        boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.25)",
      },
    }),
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  textContainer: {
    maxWidth: 100,
  },
  label: {
    fontWeight: "500",
    opacity: 0.9,
  },
  title: {
    fontWeight: "700",
  },
});
