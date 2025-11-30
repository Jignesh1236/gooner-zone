import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import BrowseScreen from "@/screens/BrowseScreen";
import MangaDetailScreen from "@/screens/MangaDetailScreen";
import ChapterReaderScreen from "@/screens/ChapterReaderScreen";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useTheme } from "@/hooks/useTheme";
import { getCommonScreenOptions } from "@/navigation/screenOptions";

export type BrowseStackParamList = {
  Browse: undefined;
  MangaDetail: { mangaId: string };
  ChapterReader: { chapterId: string; mangaId: string; mangaTitle: string };
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
    </Stack.Navigator>
  );
}
