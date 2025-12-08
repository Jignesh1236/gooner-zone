# MangaReader - Mobile Manga Reading App

## Overview
A mobile manga reading application built with Expo React Native that integrates with the MangaDex API. Users can browse popular manga, search for titles, read chapters, download for offline reading, and track their reading progress locally.

## Current State
**Version**: 1.5.0
**Last Updated**: December 5, 2025

## Tech Stack
- **Framework**: Expo SDK 54 with React Native
- **Navigation**: React Navigation 7 (Bottom Tabs + Native Stack)
- **State Management**: React hooks with AsyncStorage for persistence
- **API**: MangaDex Public API (https://api.mangadex.org)
- **UI Components**: Custom components with Liquid Glass design system
- **Animations**: react-native-reanimated
- **Gestures**: react-native-gesture-handler

## Project Architecture

### Directory Structure
```
/
├── App.tsx                    # Root component with navigation and error boundary
├── navigation/
│   ├── MainTabNavigator.tsx   # Bottom tab navigation (4 tabs)
│   ├── BrowseStackNavigator.tsx
│   ├── SearchStackNavigator.tsx
│   ├── LibraryStackNavigator.tsx
│   └── ProfileStackNavigator.tsx
├── screens/
│   ├── BrowseScreen.tsx       # Popular manga grid with infinite scroll
│   ├── SearchScreen.tsx       # Search with debounce and recent searches
│   ├── LibraryScreen.tsx      # Bookmarks and reading history
│   ├── ProfileScreen.tsx      # Settings and app info
│   ├── MangaDetailScreen.tsx  # Manga details and chapter list
│   ├── ChapterReaderScreen.tsx # Full-featured chapter reader (Standard)
│   └── LiteChapterReaderScreen.tsx # Seamless scroll reader (Lite)
├── components/
│   ├── MangaCard.tsx          # Manga cover card with press animation
│   ├── ContinueReadingButton.tsx # FAB for quick continue
│   ├── LoadingIndicator.tsx
│   ├── EmptyState.tsx
│   └── [Template components]
├── services/
│   ├── mangadex.ts           # MangaDex API client
│   ├── storage.ts            # AsyncStorage utilities
│   ├── downloadManager.ts    # Offline download management
│   └── notificationService.ts # Push notifications for new chapters
├── hooks/
│   └── [Theme and insets hooks]
└── constants/
    └── theme.ts              # Design tokens
```

### Key Features
1. **Browse Tab**: Popular manga grid with pull-to-refresh and infinite scroll
2. **Search Tab**: Real-time search with 500ms debounce, recent searches, advanced filters
3. **Library Tab**: Bookmarks, reading history, and downloaded chapters with tab switching
4. **Profile Tab**: Reading mode settings, data saver toggle, 18+ mode toggle, language selection, download management
5. **Manga Detail**: Cover, synopsis, tags, chapter list with read indicators, download buttons, similar manga recommendations
6. **Chapter Reader**: Vertical/horizontal modes, page progress, auto-save, offline support, keep screen on
7. **18+ Mode**: Toggle in Profile to show only adult content (erotica/pornographic)
8. **Language Filter**: Select from 50+ languages - only shows manga with translations in selected languages
9. **Offline Downloads**: Download chapters for offline reading with data saver mode and 7-day auto-cleanup
10. **Advanced Search Filters**: Filter by genre/tags (include/exclude), status (ongoing/completed/hiatus), sort options
11. **Push Notifications**: Get notified when bookmarked manga has new chapters (mobile only)

### Data Flow
- All manga data comes from MangaDex API
- Reading progress, bookmarks, and history stored in AsyncStorage
- Settings persisted locally
- No user authentication required (guest mode)

## Important Notes

### API Limitations
- MangaDex API has CORS restrictions - works best on native (Expo Go)
- Rate limited to ~5 requests/second
- Content filtered based on 18+ mode setting (safe/suggestive when off, erotica/pornographic when on)
- Manga filtered by available translated languages (user selects in Profile settings)
- Uses `availableTranslatedLanguage` parameter to filter manga by translation availability

### Testing
- Web preview may show API errors due to CORS
- Use Expo Go on mobile device for full functionality
- Scan QR code from terminal to test

## User Preferences
- Default reading mode: Vertical scroll
- Data saver: Enabled by default
- Theme: Auto (follows system)
- 18+ Mode: Disabled by default
- Default Languages: English + Japanese (user can customize from 50+ available languages)

## Recent Changes
- **December 5, 2025**: Keep Screen On While Reading
  - Added expo-keep-awake to all reader screens (Standard, Lite, HTML)
  - Screen automatically stays on while reading manga
  - Prevents screen from dimming or locking during reading
  - Screen lock resumes normally when leaving the reader
- **December 5, 2025**: Similar Manga Recommendations
  - Added "Agar yeh pasand aaya toh..." section on Manga Detail screen
  - Shows related manga based on shared genre and theme tags
  - Horizontal scrolling cards with cover images and titles
  - Respects adult mode setting for content filtering
  - Fetches tag IDs directly from MangaDex API for accurate matching
  - Click to navigate to similar manga details
  - Loading skeleton animation while fetching
- **December 5, 2025**: Push Notifications for New Chapters
  - Added notification service with expo-notifications, expo-task-manager, expo-background-fetch
  - Background task periodically checks bookmarked manga for new chapters
  - Sends local notifications when new chapters are available
  - Notification settings in Profile: Enable/disable toggle, check frequency (30min to 24hrs)
  - Manual "Check for Updates Now" button to check immediately
  - Chapter count tracking to detect new chapters per manga
  - Platform-safe implementation (works on mobile, graceful fallback on web)
  - Integrated notification permission handling
- **December 5, 2025**: Fixed Tall Image Memory Crash
  - Added maximum height constraint (3x screen height) for very tall manga images
  - Images with aspect ratio > 4:1 are capped to prevent memory issues
  - Applied fix to both Standard Reader (ChapterReaderScreen) and Lite Reader (LiteChapterReaderScreen)
  - Images still render correctly with `contentFit="contain"` within constrained height
  - Prevents crash when displaying webtoon-style long-strip manga pages
- **December 2, 2025**: Dual Reader System
  - **Standard Reader (Reader 1)**: Full-featured reader with controls, page navigation buttons, progress bar, tap to show/hide header and footer
  - **Lite Reader (Reader 2)**: Lightweight seamless scrolling reader with no gaps between images, pull-to-refresh, minimal UI for distraction-free reading
  - Reader type selection in Profile settings (Standard/Lite toggle)
  - Both readers share reading progress and work with offline downloads
  - Lite reader features: images fit to screen width, no padding between pages, refresh button in header, auto-hide header on scroll
- **December 1, 2025**: Offline Downloads & Advanced Search Filters
  - **Download Manager**: Save chapters for offline reading using expo-file-system
  - **Data Saver Mode**: Download lower quality images to save storage/bandwidth
  - **Auto-Cleanup**: Automatically delete downloads older than 7 days
  - **Downloads Tab**: View and manage downloaded chapters in Library screen
  - **Storage Stats**: See total download size in Profile settings
  - **Advanced Search Filters**: Filter by genre tags (include/exclude), status, sort options
  - **Search Filters Modal**: Beautiful modal with tag categories and multi-select
  - **Filter Badge**: Shows active filter count on search bar
  - Chapter reader prioritizes offline images when available
- **December 1, 2025**: Improved Chapter Reader
  - Enhanced image loading with shimmer/skeleton placeholders
  - Added image prefetching for next 3 pages (smooth scrolling)
  - Added retry button for failed image loads
  - Added fade-in animation when images load
  - Added page number badge on each image
  - Better FlatList performance with optimized batch rendering
  - Resume reading from exact saved page position
  - Added page slider for quick navigation
  - Installed @react-native-community/slider@5.0.1
- Added language filter feature with 50+ MangaDex-supported languages
- Only manga with translations in user-selected languages are shown
- Languages include regional variants (zh-hk, pt-br, es-la) and romanized versions (ja-ro, ko-ro)
- Added 18+ mode toggle in Profile settings
- When 18+ mode enabled, shows only adult content (erotica/pornographic)
- When 18+ mode disabled, shows safe/suggestive content
- Initial MVP implementation
- MangaDex API integration
- Local storage for progress tracking
- 4-tab navigation with chapter reader
