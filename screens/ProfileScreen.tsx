import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Switch,
  Linking,
  FlatList,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import Constants from "expo-constants";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { storage, AppSettings } from "@/services/storage";

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "ja", name: "Japanese" },
  { code: "zh", name: "Chinese" },
  { code: "ko", name: "Korean" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "pt-br", name: "Portuguese (BR)" },
  { code: "pt", name: "Portuguese" },
  { code: "it", name: "Italian" },
  { code: "ru", name: "Russian" },
  { code: "ar", name: "Arabic" },
  { code: "hi", name: "Hindi" },
  { code: "th", name: "Thai" },
  { code: "pl", name: "Polish" },
];

export default function ProfileScreen() {
  const { theme } = useTheme();

  const [settings, setSettings] = useState<AppSettings>({
    readingMode: "vertical",
    theme: "auto",
    dataSaver: true,
    chapterLanguages: ["en", "ja", "zh", "ko", "es", "fr", "de", "pt-br", "pt", "it", "ru", "ar", "hi", "th", "pl"],
  });

  const [showLanguagePicker, setShowLanguagePicker] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const savedSettings = await storage.getSettings();
    setSettings(savedSettings);
  };

  const updateSetting = async (key: keyof AppSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await storage.saveSettings(newSettings);
  };

  const openMangaDex = async () => {
    try {
      await Linking.openURL("https://mangadex.org");
    } catch (error) {
      console.error("Failed to open URL:", error);
    }
  };

  const appVersion = Constants.expoConfig?.version || "1.0.0";

  return (
    <ScreenScrollView>
      <View style={styles.section}>
        <ThemedText
          type="caption"
          style={[styles.sectionTitle, { color: theme.textSecondary }]}
        >
          READING PREFERENCES
        </ThemedText>
        <View
          style={[
            styles.sectionContent,
            { backgroundColor: theme.backgroundDefault },
          ]}
        >
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Feather name="smartphone" size={20} color={theme.text} />
              <ThemedText type="body">Reading Mode</ThemedText>
            </View>
            <View style={styles.segmentedControl}>
              <Pressable
                onPress={() => updateSetting("readingMode", "vertical")}
                style={[
                  styles.segment,
                  settings.readingMode === "vertical" && {
                    backgroundColor: theme.primary,
                  },
                ]}
              >
                <ThemedText
                  type="caption"
                  style={{
                    color:
                      settings.readingMode === "vertical"
                        ? "#FFFFFF"
                        : theme.textSecondary,
                  }}
                >
                  Vertical
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => updateSetting("readingMode", "horizontal")}
                style={[
                  styles.segment,
                  settings.readingMode === "horizontal" && {
                    backgroundColor: theme.primary,
                  },
                ]}
              >
                <ThemedText
                  type="caption"
                  style={{
                    color:
                      settings.readingMode === "horizontal"
                        ? "#FFFFFF"
                        : theme.textSecondary,
                  }}
                >
                  Horizontal
                </ThemedText>
              </Pressable>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.cardBorder }]} />

          <Pressable
            onPress={() => setShowLanguagePicker(!showLanguagePicker)}
            style={({ pressed }) => [
              styles.settingRow,
              { opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <View style={styles.settingInfo}>
              <Feather name="globe" size={20} color={theme.text} />
              <View>
                <ThemedText type="body">Manga Languages</ThemedText>
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary }}
                >
                  {settings.chapterLanguages.length} selected
                </ThemedText>
              </View>
            </View>
            <Feather 
              name={showLanguagePicker ? "chevron-up" : "chevron-down"} 
              size={20} 
              color={theme.textSecondary} 
            />
          </Pressable>

          {showLanguagePicker && (
            <>
              <View style={[styles.divider, { backgroundColor: theme.cardBorder }]} />
              <View style={styles.languageGrid}>
                {LANGUAGES.map((lang) => {
                  const isSelected = settings.chapterLanguages.includes(lang.code);
                  return (
                    <Pressable
                      key={lang.code}
                      onPress={async () => {
                        let newLanguages = [...settings.chapterLanguages];
                        if (isSelected) {
                          newLanguages = newLanguages.filter(l => l !== lang.code);
                          if (newLanguages.length === 0) newLanguages = ["en"];
                        } else {
                          newLanguages.push(lang.code);
                        }
                        await updateSetting("chapterLanguages", newLanguages);
                      }}
                      style={[
                        styles.languageButton,
                        {
                          backgroundColor: isSelected
                            ? theme.primary
                            : theme.backgroundSecondary,
                        },
                      ]}
                    >
                      <View style={styles.languageButtonContent}>
                        <View
                          style={[
                            styles.checkbox,
                            {
                              borderColor: isSelected ? theme.primary : theme.textSecondary,
                              backgroundColor: isSelected ? theme.primary : "transparent",
                            },
                          ]}
                        >
                          {isSelected && (
                            <Feather name="check" size={12} color="#FFFFFF" />
                          )}
                        </View>
                        <ThemedText
                          type="caption"
                          style={{
                            color: isSelected ? "#FFFFFF" : theme.text,
                            textAlign: "center",
                            flex: 1,
                          }}
                        >
                          {lang.name}
                        </ThemedText>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          <View style={[styles.divider, { backgroundColor: theme.cardBorder }]} />

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Feather name="zap" size={20} color={theme.text} />
              <View>
                <ThemedText type="body">Data Saver</ThemedText>
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary }}
                >
                  Lower quality images
                </ThemedText>
              </View>
            </View>
            <Switch
              value={settings.dataSaver}
              onValueChange={(value) => updateSetting("dataSaver", value)}
              trackColor={{ false: theme.backgroundSecondary, true: theme.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText
          type="caption"
          style={[styles.sectionTitle, { color: theme.textSecondary }]}
        >
          ABOUT
        </ThemedText>
        <View
          style={[
            styles.sectionContent,
            { backgroundColor: theme.backgroundDefault },
          ]}
        >
          <Pressable
            onPress={openMangaDex}
            style={({ pressed }) => [
              styles.settingRow,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <View style={styles.settingInfo}>
              <Feather name="external-link" size={20} color={theme.text} />
              <ThemedText type="body">MangaDex</ThemedText>
            </View>
            <Feather name="chevron-right" size={20} color={theme.textSecondary} />
          </Pressable>

          <View style={[styles.divider, { backgroundColor: theme.cardBorder }]} />

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Feather name="info" size={20} color={theme.text} />
              <ThemedText type="body">Version</ThemedText>
            </View>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              {appVersion}
            </ThemedText>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <ThemedText
          type="caption"
          style={[styles.footerText, { color: theme.textSecondary }]}
        >
          Powered by MangaDex API
        </ThemedText>
        <ThemedText
          type="caption"
          style={[styles.footerText, { color: theme.textSecondary }]}
        >
          All manga content belongs to their respective owners
        </ThemedText>
      </View>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
    marginLeft: Spacing.sm,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  sectionContent: {
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
  },
  settingInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    flex: 1,
  },
  divider: {
    height: 1,
    marginLeft: Spacing.lg + 20 + Spacing.md,
  },
  segmentedControl: {
    flexDirection: "row",
    borderRadius: BorderRadius.xs,
    overflow: "hidden",
  },
  segment: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  footer: {
    marginTop: Spacing.xl,
    alignItems: "center",
    gap: Spacing.xs,
  },
  footerText: {
    textAlign: "center",
  },
  languageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  languageButton: {
    width: "48%",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  languageButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    width: "100%",
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: BorderRadius.xs,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
