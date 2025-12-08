import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import BrowseScreen from "@/screens/BrowseScreen";
import MangaDetailScreen from "@/screens/MangaDetailScreen";
import ChapterReaderScreen from "@/screens/ChapterReaderScreen";
import LiteChapterReaderScreen from "@/screens/LiteChapterReaderScreen";
import HtmlChapterReaderScreen from "@/screens/HtmlChapterReaderScreen";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useTheme } from "@/hooks/useTheme";
import { getCommonScreenOptions } from "@/navigation/screenOptions";

export type BrowseStackParamList = {
  Browse: undefined;
  MangaDetail: { mangaId: string };
  ChapterReader: { chapterId: string; mangaId: string; mangaTitle: string; chapterNumber: string };
  LiteChapterReader: { chapterId: string; mangaId: string; mangaTitle: string; chapterNumber: string };
  HtmlChapterReader: { chapterId: string; mangaId: string; mangaTitle: string; chapterNumber: string };
};

const Stack = createNativeStackNavigator<BrowseStackParamList>();

export default function BrowseStackNavigator() {
  const { theme, isDark } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        ...getCommonScreenOptions({ theme, isDark }),
      }}
    >
      <Stack.Screen
        name="Browse"
        component={BrowseScreen}
        options={{
          headerTitle: () => <HeaderTitle title="MangaReader" />,
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
      <Stack.Screen
        name="LiteChapterReader"
        component={LiteChapterReaderScreen}
        options={{
          headerShown: false,
          presentation: "fullScreenModal",
          animation: "fade",
        }}
      />
      <Stack.Screen
        name="HtmlChapterReader"
        component={HtmlChapterReaderScreen}
        options={{
          headerShown: false,
          presentation: "fullScreenModal",
          animation: "fade",
        }}
      />
    </Stack.Navigator>
  );
}
