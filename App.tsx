import React, { useEffect } from "react";
import { StyleSheet, Platform } from "react-native";
import { NavigationContainer, LinkingOptions } from "@react-navigation/native";
import * as Linking from "expo-linking";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import MainTabNavigator from "@/navigation/MainTabNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const prefix = Linking.createURL("/");

const linking: LinkingOptions<any> = {
  prefixes: [prefix, "mangadex://", "https://mangadex.org"],
  config: {
    screens: {
      Browse: {
        screens: {
          MangaDetail: "title/:mangaId",
        },
      },
    },
  },
  async getInitialURL() {
    const url = await Linking.getInitialURL();
    if (url != null) {
      return url;
    }
  },
  subscribe(listener: (url: string) => void) {
    const onReceiveURL = ({ url }: { url: string }) => {
      listener(url);
    };
    const subscription = Linking.addEventListener("url", onReceiveURL);
    return () => {
      subscription.remove();
    };
  },
};

export default function App() {
  useEffect(() => {
    // Notifications are not supported in Expo Go since SDK 53
    // Only initialize in development builds
    if (Platform.OS !== "web" && !__DEV__) {
      import("@/services/notificationService").then(({ notificationService }) => {
        notificationService.initialize();
      }).catch(err => {
        console.log("Notification service not available:", err.message);
      });
    }
  }, []);

  return (
  <ErrorBoundary>
    <SafeAreaProvider>
        <GestureHandlerRootView style={styles.root}>
          <KeyboardProvider>
            <NavigationContainer linking={linking} fallback={null}>
              <MainTabNavigator />
            </NavigationContainer>
            <StatusBar style="auto" />
          </KeyboardProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
  </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
