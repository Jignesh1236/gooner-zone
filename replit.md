# MangaReader - Mobile Manga Reading App

## Overview
A mobile manga reading application built with Expo React Native that integrates with the MangaDex API. Users can browse popular manga, search for titles, read chapters, and track their reading progress locally.

## Current State
**Version**: 1.0.0
**Status**: MVP Complete
**Last Updated**: November 27, 2025

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
│   └── ChapterReaderScreen.tsx # Full-screen chapter reader
├── components/
│   ├── MangaCard.tsx          # Manga cover card with press animation
│   ├── ContinueReadingButton.tsx # FAB for quick continue
│   ├── LoadingIndicator.tsx
│   ├── EmptyState.tsx
│   └── [Template components]
├── services/
│   ├── mangadex.ts           # MangaDex API client
│   └── storage.ts            # AsyncStorage utilities
├── hooks/
│   └── [Theme and insets hooks]
└── constants/
    └── theme.ts              # Design tokens
```

### Key Features
1. **Browse Tab**: Popular manga grid with pull-to-refresh and infinite scroll
2. **Search Tab**: Real-time search with 500ms debounce, recent searches
3. **Library Tab**: Bookmarks and reading history with tab switching
4. **Profile Tab**: Reading mode settings, data saver toggle
5. **Manga Detail**: Cover, synopsis, tags, chapter list with read indicators
6. **Chapter Reader**: Vertical/horizontal modes, page progress, auto-save

### Data Flow
- All manga data comes from MangaDex API
- Reading progress, bookmarks, and history stored in AsyncStorage
- Settings persisted locally
- No user authentication required (guest mode)

## Important Notes

### API Limitations
- MangaDex API has CORS restrictions - works best on native (Expo Go)
- Rate limited to ~5 requests/second
- Only safe-for-work content fetched
- English chapters prioritized

### Testing
- Web preview may show API errors due to CORS
- Use Expo Go on mobile device for full functionality
- Scan QR code from Replit URL bar to test

## User Preferences
- Default reading mode: Vertical scroll
- Data saver: Enabled by default
- Theme: Auto (follows system)

## Recent Changes
- Initial MVP implementation
- MangaDex API integration
- Local storage for progress tracking
- 4-tab navigation with chapter reader
