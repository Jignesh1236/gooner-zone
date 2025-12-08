import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useTheme } from "@/hooks/useTheme";

interface LoadingIndicatorProps {
  size?: "small" | "large";
  fullScreen?: boolean;
}

export function LoadingIndicator({
  size = "large",
  fullScreen = false,
}: LoadingIndicatorProps) {
  const { theme } = useTheme();

  if (fullScreen) {
    return (
      <View style={[styles.fullScreen, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size={size} color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={theme.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  fullScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
