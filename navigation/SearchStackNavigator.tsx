import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import SearchScreen from "@/screens/SearchScreen";
import MangaDetailScreen from "@/screens/MangaDetailScreen";
import ChapterReaderScreen from "@/screens/ChapterReaderScreen";
import { useTheme } from "@/hooks/useTheme";
import { getCommonScreenOptions } from "@/navigation/screenOptions";

export type SearchStackParamList = {
  Search: undefined;
  MangaDetail: { mangaId: string };
  ChapterReader: { chapterId: string; mangaId: string; mangaTitle: string };
};

const Stack = createNativeStackNavigator<SearchStackParamList>();

export default function SearchStackNavigator() {
  const { theme, isDark } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        ...getCommonScreenOptions({ theme, isDark }),
      }}
    >
      <Stack.Screen
        name="Search"
        component={SearchScreen}
        options={{
          headerTitle: "Search",
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
