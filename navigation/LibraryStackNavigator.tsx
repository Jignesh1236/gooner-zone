import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LibraryScreen from "@/screens/LibraryScreen";
import MangaDetailScreen from "@/screens/MangaDetailScreen";
import ChapterReaderScreen from "@/screens/ChapterReaderScreen";
import { useTheme } from "@/hooks/useTheme";
import { getCommonScreenOptions } from "@/navigation/screenOptions";

export type LibraryStackParamList = {
  Library: undefined;
  MangaDetail: { mangaId: string };
  ChapterReader: { chapterId: string; mangaId: string; mangaTitle: string };
};

const Stack = createNativeStackNavigator<LibraryStackParamList>();

export default function LibraryStackNavigator() {
  const { theme, isDark } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        ...getCommonScreenOptions({ theme, isDark }),
      }}
    >
      <Stack.Screen
        name="Library"
        component={LibraryScreen}
        options={{
          headerTitle: "Library",
        }}
      />
      <Stack.Screen
        name="MangaDetail"
        component={MangaDetailScreen}
        options={{
          headerTitle: "",
          headerTransparent: true,
        }}
      />
      <Stack.Screen
        name="ChapterReader"
        component={ChapterReaderScreen}
        options={{
          headerShown: false,
          presentation: "fullScreenModal",
          animation: "fade",
        }}
      />
    </Stack.Navigator>
  );
}
