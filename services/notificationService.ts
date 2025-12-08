import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { storage, BookmarkedManga } from "./storage";
import { mangadexApi } from "./mangadex";

let Notifications: any = null;
let TaskManager: any = null;
let BackgroundFetch: any = null;

if (Platform.OS !== "web") {
  Notifications = require("expo-notifications");
  TaskManager = require("expo-task-manager");
  BackgroundFetch = require("expo-background-fetch");
}

const BACKGROUND_FETCH_TASK = "MANGA_UPDATE_CHECK_TASK";
const LAST_CHAPTER_COUNTS_KEY = "@mangareader_last_chapter_counts";
const NOTIFICATION_SETTINGS_KEY = "@mangareader_notification_settings";

export interface NotificationSettings {
  enabled: boolean;
  checkIntervalMinutes: number;
}

interface ChapterCountRecord {
  mangaId: string;
  lastChapterCount: number;
  lastCheckedAt: number;
  latestChapterNumber: string;
}

const defaultNotificationSettings: NotificationSettings = {
  enabled: true,
  checkIntervalMinutes: 60,
};

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

const checkForUpdatesTask = async () => {
  const settings = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
  const notificationSettings = settings
    ? { ...defaultNotificationSettings, ...JSON.parse(settings) }
    : defaultNotificationSettings;

  if (!notificationSettings.enabled) {
    return BackgroundFetch?.BackgroundFetchResult?.NoData || 1;
  }

  try {
    const bookmarksData = await AsyncStorage.getItem("@mangareader_bookmarks");
    const bookmarks = bookmarksData ? JSON.parse(bookmarksData) : [];
    if (bookmarks.length === 0) {
      return BackgroundFetch?.BackgroundFetchResult?.NoData || 1;
    }

    const settingsData = await AsyncStorage.getItem("@mangareader_settings");
    const appSettings = settingsData ? JSON.parse(settingsData) : { chapterLanguages: ["en"], adultMode: false };

    const countsData = await AsyncStorage.getItem(LAST_CHAPTER_COUNTS_KEY);
    const lastCounts = countsData ? JSON.parse(countsData) : {};

    for (const manga of bookmarks) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const chapters = await mangadexApi.getChapters(
          manga.id,
          appSettings.chapterLanguages,
          appSettings.adultMode
        );

        const chapterCount = chapters.length;
        const latestChapter = chapters.length > 0 ? chapters[chapters.length - 1].chapter : "0";
        const lastRecord = lastCounts[manga.id];

        if (lastRecord && chapterCount > lastRecord.lastChapterCount) {
          await Notifications?.scheduleNotificationAsync({
            content: {
              title: "New Chapter Available!",
              body: `${manga.title} - Chapter ${latestChapter} is now available`,
              data: { mangaId: manga.id, type: "new_chapter" },
              sound: true,
            },
            trigger: null,
          });
        }

        lastCounts[manga.id] = {
          mangaId: manga.id,
          lastChapterCount: chapterCount,
          lastCheckedAt: Date.now(),
          latestChapterNumber: latestChapter,
        };
      } catch (error) {
        console.error(`Background: Failed to check ${manga.title}:`, error);
      }
    }

    await AsyncStorage.setItem(LAST_CHAPTER_COUNTS_KEY, JSON.stringify(lastCounts));
    console.log("Background fetch task completed successfully");
    return BackgroundFetch?.BackgroundFetchResult?.NewData || 2;
  } catch (error) {
    console.error("Background fetch task failed:", error);
    return BackgroundFetch?.BackgroundFetchResult?.Failed || 3;
  }
};

if (TaskManager && BackgroundFetch) {
  TaskManager.defineTask(BACKGROUND_FETCH_TASK, checkForUpdatesTask);
}

export const notificationService = {
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === "web") {
      return false;
    }

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === "granted";
  },

  async getPermissionStatus(): Promise<string> {
    if (Platform.OS === "web") {
      return "denied";
    }
    const { status } = await Notifications.getPermissionsAsync();
    return status;
  },

  async sendLocalNotification(
    title: string,
    body: string,
    data?: Record<string, any>
  ): Promise<string | null> {
    if (Platform.OS === "web") {
      return null;
    }

    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: true,
        },
        trigger: null,
      });
      return notificationId;
    } catch (error) {
      console.error("Failed to send notification:", error);
      return null;
    }
  },

  async sendNewChapterNotification(
    mangaTitle: string,
    newChapterNumber: string,
    mangaId: string
  ): Promise<void> {
    await this.sendLocalNotification(
      `New Chapter Available!`,
      `${mangaTitle} - Chapter ${newChapterNumber} is now available`,
      { mangaId, type: "new_chapter" }
    );
  },

  async getNotificationSettings(): Promise<NotificationSettings> {
    try {
      const data = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      return data
        ? { ...defaultNotificationSettings, ...JSON.parse(data) }
        : defaultNotificationSettings;
    } catch {
      return defaultNotificationSettings;
    }
  },

  async saveNotificationSettings(
    settings: Partial<NotificationSettings>
  ): Promise<void> {
    const current = await this.getNotificationSettings();
    const updated = { ...current, ...settings };
    await AsyncStorage.setItem(
      NOTIFICATION_SETTINGS_KEY,
      JSON.stringify(updated)
    );

    if (updated.enabled) {
      await this.registerBackgroundTask(updated.checkIntervalMinutes);
    } else {
      await this.unregisterBackgroundTask();
    }
  },

  async getLastChapterCounts(): Promise<Record<string, ChapterCountRecord>> {
    try {
      const data = await AsyncStorage.getItem(LAST_CHAPTER_COUNTS_KEY);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  },

  async saveChapterCount(
    mangaId: string,
    chapterCount: number,
    latestChapterNumber: string
  ): Promise<void> {
    const counts = await this.getLastChapterCounts();
    counts[mangaId] = {
      mangaId,
      lastChapterCount: chapterCount,
      lastCheckedAt: Date.now(),
      latestChapterNumber,
    };
    await AsyncStorage.setItem(
      LAST_CHAPTER_COUNTS_KEY,
      JSON.stringify(counts)
    );
  },

  async checkForUpdates(): Promise<{
    updatedManga: Array<{
      manga: BookmarkedManga;
      newChapterCount: number;
      latestChapter: string;
    }>;
  }> {
    const settings = await this.getNotificationSettings();
    if (!settings.enabled) {
      return { updatedManga: [] };
    }

    const bookmarks = await storage.getBookmarks();
    if (bookmarks.length === 0) {
      return { updatedManga: [] };
    }

    const lastCounts = await this.getLastChapterCounts();
    const appSettings = await storage.getSettings();
    const updatedManga: Array<{
      manga: BookmarkedManga;
      newChapterCount: number;
      latestChapter: string;
    }> = [];

    for (const manga of bookmarks) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 500));

        const chapters = await mangadexApi.getChapters(
          manga.id,
          appSettings.chapterLanguages,
          appSettings.adultMode
        );

        const chapterCount = chapters.length;
        const latestChapter =
          chapters.length > 0
            ? chapters[chapters.length - 1].chapter
            : "0";

        const lastRecord = lastCounts[manga.id];

        if (lastRecord) {
          if (chapterCount > lastRecord.lastChapterCount) {
            const newChapterCount =
              chapterCount - lastRecord.lastChapterCount;
            updatedManga.push({
              manga,
              newChapterCount,
              latestChapter,
            });

            await this.sendNewChapterNotification(
              manga.title,
              latestChapter,
              manga.id
            );
          }
        }

        await this.saveChapterCount(manga.id, chapterCount, latestChapter);
      } catch (error) {
        console.error(
          `Failed to check updates for ${manga.title}:`,
          error
        );
      }
    }

    return { updatedManga };
  },

  async initializeChapterCounts(): Promise<void> {
    const bookmarks = await storage.getBookmarks();
    const lastCounts = await this.getLastChapterCounts();
    const appSettings = await storage.getSettings();

    for (const manga of bookmarks) {
      if (!lastCounts[manga.id]) {
        try {
          await new Promise((resolve) => setTimeout(resolve, 500));
          const chapters = await mangadexApi.getChapters(
            manga.id,
            appSettings.chapterLanguages,
            appSettings.adultMode
          );
          const latestChapter =
            chapters.length > 0
              ? chapters[chapters.length - 1].chapter
              : "0";
          await this.saveChapterCount(
            manga.id,
            chapters.length,
            latestChapter
          );
        } catch (error) {
          console.error(
            `Failed to initialize counts for ${manga.title}:`,
            error
          );
        }
      }
    }
  },

  async registerBackgroundTask(intervalMinutes: number = 60): Promise<boolean> {
    if (Platform.OS === "web") {
      return false;
    }

    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(
        BACKGROUND_FETCH_TASK
      );
      if (isRegistered) {
        await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
      }

      await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
        minimumInterval: intervalMinutes * 60,
        stopOnTerminate: false,
        startOnBoot: true,
      });

      console.log("Background task registered successfully");
      return true;
    } catch (error) {
      console.error("Failed to register background task:", error);
      return false;
    }
  },

  async unregisterBackgroundTask(): Promise<void> {
    if (Platform.OS === "web") {
      return;
    }

    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(
        BACKGROUND_FETCH_TASK
      );
      if (isRegistered) {
        await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
        console.log("Background task unregistered");
      }
    } catch (error) {
      console.error("Failed to unregister background task:", error);
    }
  },

  async isBackgroundTaskRegistered(): Promise<boolean> {
    if (Platform.OS === "web") {
      return false;
    }

    try {
      return await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
    } catch {
      return false;
    }
  },

  async initialize(): Promise<void> {
    const settings = await this.getNotificationSettings();
    const hasPermission = await this.requestPermissions();

    if (hasPermission && settings.enabled) {
      await this.initializeChapterCounts();
      await this.registerBackgroundTask(settings.checkIntervalMinutes);
    }
  },

  async manualCheck(): Promise<{
    updatedManga: Array<{
      manga: BookmarkedManga;
      newChapterCount: number;
      latestChapter: string;
    }>;
  }> {
    return await this.checkForUpdates();
  },

  async clearAllNotifications(): Promise<void> {
    if (Platform.OS === "web") {
      return;
    }

    await Notifications.dismissAllNotificationsAsync();
    await Notifications.setBadgeCountAsync(0);
  },

  async getBadgeCount(): Promise<number> {
    if (Platform.OS === "web") {
      return 0;
    }

    return await Notifications.getBadgeCountAsync();
  },

  async setBadgeCount(count: number): Promise<void> {
    if (Platform.OS === "web") {
      return;
    }

    await Notifications.setBadgeCountAsync(count);
  },
};
