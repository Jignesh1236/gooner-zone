import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Switch,
  Linking,
  FlatList,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import Slider from "@react-native-community/slider";
import { Feather } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useFocusEffect } from "@react-navigation/native";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { storage, AppSettings } from "@/services/storage";
import { downloadManager } from "@/services/downloadManager";
import {
  notificationService,
  NotificationSettings,
} from "@/services/notificationService";

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "ja", name: "Japanese" },
  { code: "ja-ro", name: "Japanese (Romanized)" },
  { code: "zh", name: "Chinese (Simplified)" },
  { code: "zh-hk", name: "Chinese (Traditional)" },
  { code: "zh-ro", name: "Chinese (Romanized)" },
  { code: "ko", name: "Korean" },
  { code: "ko-ro", name: "Korean (Romanized)" },
  { code: "es", name: "Spanish (Spain)" },
  { code: "es-la", name: "Spanish (Latin America)" },
  { code: "pt-br", name: "Portuguese (Brazil)" },
  { code: "pt", name: "Portuguese" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "ru", name: "Russian" },
  { code: "pl", name: "Polish" },
  { code: "tr", name: "Turkish" },
  { code: "id", name: "Indonesian" },
  { code: "vi", name: "Vietnamese" },
  { code: "th", name: "Thai" },
  { code: "ar", name: "Arabic" },
  { code: "he", name: "Hebrew" },
  { code: "fa", name: "Persian" },
  { code: "hi", name: "Hindi" },
  { code: "ta", name: "Tamil" },
  { code: "ne", name: "Nepali" },
  { code: "mn", name: "Mongolian" },
  { code: "el", name: "Greek" },
  { code: "hu", name: "Hungarian" },
  { code: "ro", name: "Romanian" },
  { code: "cs", name: "Czech" },
  { code: "uk", name: "Ukrainian" },
  { code: "bg", name: "Bulgarian" },
  { code: "sv", name: "Swedish" },
  { code: "da", name: "Danish" },
  { code: "nl", name: "Dutch" },
  { code: "no", name: "Norwegian" },
  { code: "fi", name: "Finnish" },
  { code: "ms", name: "Malay" },
  { code: "tl", name: "Filipino" },
  { code: "my", name: "Burmese" },
  { code: "bn", name: "Bengali" },
  { code: "hr", name: "Croatian" },
  { code: "sr", name: "Serbian" },
  { code: "sk", name: "Slovak" },
  { code: "lt", name: "Lithuanian" },
  { code: "lv", name: "Latvian" },
  { code: "et", name: "Estonian" },
  { code: "ka", name: "Georgian" },
  { code: "az", name: "Azerbaijani" },
  { code: "kk", name: "Kazakh" },
  { code: "uz", name: "Uzbek" },
];

export default function ProfileScreen() {
  const { theme } = useTheme();

  const [settings, setSettings] = useState<AppSettings>({
    readingMode: "vertical",
    readerType: "lite",
    theme: "auto",
    dataSaver: true,
    chapterLanguages: ["en", "ja"],
    adultMode: false,
    volumeScrollEnabled: true,
    volumeScrollSensitivity: 50,
  });

  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [downloadCount, setDownloadCount] = useState(0);
  const [totalDownloadSize, setTotalDownloadSize] = useState(0);
  const [notificationSettings, setNotificationSettings] =
    useState<NotificationSettings>({
      enabled: true,
      checkIntervalMinutes: 60,
    });
  const [notificationPermission, setNotificationPermission] = useState<string>("undetermined");
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [showIntervalPicker, setShowIntervalPicker] = useState(false);

  const CHECK_INTERVALS = [
    { label: "Every 30 minutes", value: 30 },
    { label: "Every hour", value: 60 },
    { label: "Every 2 hours", value: 120 },
    { label: "Every 4 hours", value: 240 },
    { label: "Every 6 hours", value: 360 },
    { label: "Every 12 hours", value: 720 },
    { label: "Every 24 hours", value: 1440 },
  ];

  const loadDownloadInfo = useCallback(async () => {
    const downloads = await downloadManager.getAllDownloads();
    setDownloadCount(downloads.length);
    setTotalDownloadSize(downloads.reduce((sum, d) => sum + d.totalSize, 0));
  }, []);

  const loadNotificationSettings = useCallback(async () => {
    const savedSettings = await notificationService.getNotificationSettings();
    setNotificationSettings(savedSettings);
    const permission = await notificationService.getPermissionStatus();
    setNotificationPermission(permission);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDownloadInfo();
      loadNotificationSettings();
    }, [loadDownloadInfo, loadNotificationSettings])
  );

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const savedSettings = await storage.getSettings();
    setSettings(savedSettings);
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleClearDownloads = () => {
    if (downloadCount === 0) {
      Alert.alert("No Downloads", "You don't have any downloaded chapters.");
      return;
    }
    
    Alert.alert(
      "Clear All Downloads",
      `This will delete ${downloadCount} downloaded chapter${downloadCount !== 1 ? "s" : ""} (${formatSize(totalDownloadSize)}). Continue?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete All",
          style: "destructive",
          onPress: async () => {
            await downloadManager.deleteAllDownloads();
            loadDownloadInfo();
          },
        },
      ]
    );
  };

  const updateSetting = async (key: keyof AppSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await storage.saveSettings(newSettings);
  };

  const handleNotificationToggle = async (enabled: boolean) => {
    if (Platform.OS === "web") {
      Alert.alert(
        "Not Available",
        "Push notifications are only available on mobile devices."
      );
      return;
    }

    if (enabled && notificationPermission !== "granted") {
      const granted = await notificationService.requestPermissions();
      if (!granted) {
        Alert.alert(
          "Permission Required",
          "Please enable notifications in your device settings to receive manga updates."
        );
        return;
      }
      setNotificationPermission("granted");
    }

    const newSettings = { ...notificationSettings, enabled };
    setNotificationSettings(newSettings);
    await notificationService.saveNotificationSettings(newSettings);

    if (enabled) {
      await notificationService.initializeChapterCounts();
    }
  };

  const handleIntervalChange = async (minutes: number) => {
    const newSettings = { ...notificationSettings, checkIntervalMinutes: minutes };
    setNotificationSettings(newSettings);
    await notificationService.saveNotificationSettings(newSettings);
    setShowIntervalPicker(false);
  };

  const handleManualCheck = async () => {
    if (isCheckingUpdates) return;

    setIsCheckingUpdates(true);
    try {
      const result = await notificationService.manualCheck();
      if (result.updatedManga.length > 0) {
        Alert.alert(
          "Updates Found!",
          `Found ${result.updatedManga.length} manga with new chapters.`
        );
      } else {
        Alert.alert("No Updates", "All your bookmarked manga are up to date.");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to check for updates. Please try again.");
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  const getIntervalLabel = (minutes: number): string => {
    const interval = CHECK_INTERVALS.find((i) => i.value === minutes);
    return interval?.label || `Every ${minutes} minutes`;
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

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Feather name="book-open" size={20} color={theme.text} />
              <View>
                <ThemedText type="body">Reader Type</ThemedText>
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary }}
                >
                  {settings.readerType === "lite" ? "Lite - Seamless scroll" : settings.readerType === "html" ? "HTML - WebView based" : "Standard - With controls"}
                </ThemedText>
              </View>
            </View>
            <View style={styles.segmentedControl}>
              <Pressable
                onPress={() => updateSetting("readerType", "standard")}
                style={[
                  styles.segment,
                  settings.readerType === "standard" && {
                    backgroundColor: theme.primary,
                  },
                ]}
              >
                <ThemedText
                  type="caption"
                  style={{
                    color:
                      settings.readerType === "standard"
                        ? "#FFFFFF"
                        : theme.textSecondary,
                  }}
                >
                  Standard
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => updateSetting("readerType", "lite")}
                style={[
                  styles.segment,
                  settings.readerType === "lite" && {
                    backgroundColor: theme.primary,
                  },
                ]}
              >
                <ThemedText
                  type="caption"
                  style={{
                    color:
                      settings.readerType === "lite"
                        ? "#FFFFFF"
                        : theme.textSecondary,
                  }}
                >
                  Lite
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => updateSetting("readerType", "html")}
                style={[
                  styles.segment,
                  settings.readerType === "html" && {
                    backgroundColor: theme.primary,
                  },
                ]}
              >
                <ThemedText
                  type="caption"
                  style={{
                    color:
                      settings.readerType === "html"
                        ? "#FFFFFF"
                        : theme.textSecondary,
                  }}
                >
                  HTML
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

          <View style={[styles.divider, { backgroundColor: theme.cardBorder }]} />

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Feather name="volume-2" size={20} color={theme.text} />
              <View>
                <ThemedText type="body">Volume Key Navigation</ThemedText>
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary }}
                >
                  Scroll pages with volume buttons
                </ThemedText>
              </View>
            </View>
            <Switch
              value={settings.volumeScrollEnabled}
              onValueChange={(value) => updateSetting("volumeScrollEnabled", value)}
              trackColor={{ false: theme.backgroundSecondary, true: theme.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          {settings.volumeScrollEnabled && (
            <>
              <View style={[styles.divider, { backgroundColor: theme.cardBorder }]} />
              <View style={styles.sliderRow}>
                <View style={styles.sliderHeader}>
                  <Feather name="sliders" size={18} color={theme.text} />
                  <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                    Scroll Sensitivity
                  </ThemedText>
                  <ThemedText
                    type="caption"
                    style={{ color: theme.textSecondary, marginLeft: "auto" }}
                  >
                    {settings.volumeScrollSensitivity}%
                  </ThemedText>
                </View>
                <View style={styles.sliderContainer}>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    Low
                  </ThemedText>
                  <Slider
                    style={styles.slider}
                    minimumValue={10}
                    maximumValue={100}
                    step={10}
                    value={settings.volumeScrollSensitivity}
                    onValueChange={(value) => updateSetting("volumeScrollSensitivity", value)}
                    minimumTrackTintColor={theme.primary}
                    maximumTrackTintColor={theme.backgroundSecondary}
                    thumbTintColor={theme.primary}
                  />
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    High
                  </ThemedText>
                </View>
              </View>
            </>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText
          type="caption"
          style={[styles.sectionTitle, { color: theme.textSecondary }]}
        >
          CONTENT
        </ThemedText>
        <View
          style={[
            styles.sectionContent,
            { backgroundColor: theme.backgroundDefault },
          ]}
        >
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Feather name="alert-circle" size={20} color={settings.adultMode ? "#FF6B6B" : theme.text} />
              <View>
                <ThemedText type="body">18+ Mode</ThemedText>
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary }}
                >
                  Show only adult content
                </ThemedText>
              </View>
            </View>
            <Switch
              value={settings.adultMode}
              onValueChange={(value) => updateSetting("adultMode", value)}
              trackColor={{ false: theme.backgroundSecondary, true: "#FF6B6B" }}
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
          NOTIFICATIONS
        </ThemedText>
        <View
          style={[
            styles.sectionContent,
            { backgroundColor: theme.backgroundDefault },
          ]}
        >
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Feather name="bell" size={20} color={theme.text} />
              <View>
                <ThemedText type="body">New Chapter Alerts</ThemedText>
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary }}
                >
                  Get notified when bookmarked manga updates
                </ThemedText>
              </View>
            </View>
            <Switch
              value={notificationSettings.enabled}
              onValueChange={handleNotificationToggle}
              trackColor={{
                false: theme.backgroundSecondary,
                true: theme.primary,
              }}
              thumbColor="#FFFFFF"
            />
          </View>

          {notificationSettings.enabled && (
            <>
              <View
                style={[styles.divider, { backgroundColor: theme.cardBorder }]}
              />

              <Pressable
                onPress={() => setShowIntervalPicker(!showIntervalPicker)}
                style={({ pressed }) => [
                  styles.settingRow,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <View style={styles.settingInfo}>
                  <Feather name="clock" size={20} color={theme.text} />
                  <View>
                    <ThemedText type="body">Check Frequency</ThemedText>
                    <ThemedText
                      type="caption"
                      style={{ color: theme.textSecondary }}
                    >
                      {getIntervalLabel(notificationSettings.checkIntervalMinutes)}
                    </ThemedText>
                  </View>
                </View>
                <Feather
                  name={showIntervalPicker ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={theme.textSecondary}
                />
              </Pressable>

              {showIntervalPicker && (
                <>
                  <View
                    style={[
                      styles.divider,
                      { backgroundColor: theme.cardBorder },
                    ]}
                  />
                  <View style={styles.intervalGrid}>
                    {CHECK_INTERVALS.map((interval) => {
                      const isSelected =
                        notificationSettings.checkIntervalMinutes ===
                        interval.value;
                      return (
                        <Pressable
                          key={interval.value}
                          onPress={() => handleIntervalChange(interval.value)}
                          style={[
                            styles.intervalButton,
                            {
                              backgroundColor: isSelected
                                ? theme.primary
                                : theme.backgroundSecondary,
                            },
                          ]}
                        >
                          <ThemedText
                            type="caption"
                            style={{
                              color: isSelected ? "#FFFFFF" : theme.text,
                              textAlign: "center",
                            }}
                          >
                            {interval.label}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}

              <View
                style={[styles.divider, { backgroundColor: theme.cardBorder }]}
              />

              <Pressable
                onPress={handleManualCheck}
                disabled={isCheckingUpdates}
                style={({ pressed }) => [
                  styles.settingRow,
                  { opacity: pressed || isCheckingUpdates ? 0.7 : 1 },
                ]}
              >
                <View style={styles.settingInfo}>
                  <Feather name="refresh-cw" size={20} color={theme.primary} />
                  <ThemedText type="body" style={{ color: theme.primary }}>
                    {isCheckingUpdates ? "Checking..." : "Check for Updates Now"}
                  </ThemedText>
                </View>
                {isCheckingUpdates && (
                  <ActivityIndicator size="small" color={theme.primary} />
                )}
              </Pressable>
            </>
          )}

          {Platform.OS === "web" && (
            <>
              <View
                style={[styles.divider, { backgroundColor: theme.cardBorder }]}
              />
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Feather name="info" size={20} color={theme.textSecondary} />
                  <ThemedText
                    type="caption"
                    style={{ color: theme.textSecondary }}
                  >
                    Notifications are only available on mobile devices
                  </ThemedText>
                </View>
              </View>
            </>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText
          type="caption"
          style={[styles.sectionTitle, { color: theme.textSecondary }]}
        >
          DOWNLOADS
        </ThemedText>
        <View
          style={[
            styles.sectionContent,
            { backgroundColor: theme.backgroundDefault },
          ]}
        >
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Feather name="hard-drive" size={20} color={theme.text} />
              <View>
                <ThemedText type="body">Storage Used</ThemedText>
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary }}
                >
                  {downloadCount} chapter{downloadCount !== 1 ? "s" : ""} - {formatSize(totalDownloadSize)}
                </ThemedText>
              </View>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.cardBorder }]} />

          <Pressable
            onPress={handleClearDownloads}
            style={({ pressed }) => [
              styles.settingRow,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <View style={styles.settingInfo}>
              <Feather name="trash-2" size={20} color="#FF6B6B" />
              <ThemedText type="body" style={{ color: "#FF6B6B" }}>
                Clear All Downloads
              </ThemedText>
            </View>
          </Pressable>

          <View style={[styles.divider, { backgroundColor: theme.cardBorder }]} />

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Feather name="clock" size={20} color={theme.text} />
              <View>
                <ThemedText type="body">Auto-delete Old Downloads</ThemedText>
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary }}
                >
                  After 7 days of inactivity
                </ThemedText>
              </View>
            </View>
            <Feather name="check" size={18} color={theme.primary} />
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

          <View style={[styles.divider, { backgroundColor: theme.cardBorder }]} />

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Feather name="user" size={20} color={theme.text} />
              <ThemedText type="body">Developer</ThemedText>
            </View>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              Jignesh
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
  intervalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  intervalButton: {
    width: "48%",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  sliderRow: {
    padding: Spacing.lg,
  },
  sliderHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sliderContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  slider: {
    flex: 1,
    height: 40,
  },
});
