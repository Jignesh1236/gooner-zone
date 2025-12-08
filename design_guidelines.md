# Manga Reader App - Design Guidelines

## Architecture Decisions

### Authentication
**Optional Authentication** - Users can browse and read without an account, but authentication unlocks additional features:
- **Guest Mode (Default)**:
  - Browse popular manga
  - Search and read chapters
  - Local progress tracking only
  - Local bookmarks only
- **Authenticated Mode** (via MangaDex OAuth):
  - All guest features plus:
  - Sync reading progress across devices
  - Cloud-saved bookmarks
  - Personal reading lists
  - Must include MangaDex OAuth flow
  - Login screen with "Continue as Guest" option
  - Account screen with logout and data sync settings

### Navigation Structure
**Tab Navigation** (4 tabs + FAB):
1. **Browse** - Popular/featured manga grid
2. **Search** - Search interface
3. **Library** - Bookmarked manga and reading history
4. **Profile** - User settings and account

**Floating Action Button**: Quick access to "Continue Reading" (last opened manga/chapter)

## Screen Specifications

### 1. Browse Screen (Home)
- **Purpose**: Discover popular and recently updated manga
- **Layout**:
  - Transparent header with app logo/title on left
  - Header right: Filter icon (by genre, status)
  - Main content: Scrollable vertical grid (2 columns on phone, 3 on tablet)
  - Safe area insets: top = headerHeight + Spacing.xl, bottom = tabBarHeight + Spacing.xl
- **Components**:
  - Manga cards with cover image, title overlay on gradient
  - Loading skeletons while fetching from API
  - Pull-to-refresh functionality
  - Infinite scroll pagination

### 2. Search Screen
- **Purpose**: Find specific manga by title
- **Layout**:
  - Standard header with search bar integrated
  - Search bar has clear button and submit on keyboard
  - Main content: Results grid (same as Browse) or empty state
  - Safe area insets: top = Spacing.xl, bottom = tabBarHeight + Spacing.xl
- **Components**:
  - Debounced search input (500ms delay)
  - Recent searches list (when input empty)
  - Results grid with same card design as Browse
  - "No results" state with illustration

### 3. Library Screen
- **Purpose**: Access bookmarked manga and reading history
- **Layout**:
  - Standard header with title "Library"
  - Header right: Sort/filter icon
  - Segmented control below header: "Bookmarks" | "History"
  - Scrollable list view
  - Safe area insets: top = Spacing.xl, bottom = tabBarHeight + Spacing.xl
- **Components**:
  - List items with thumbnail, title, last chapter read, progress indicator
  - Swipe actions: Remove from library
  - Empty state for each tab with call-to-action

### 4. Manga Detail Screen (Modal Stack)
- **Purpose**: View manga information and chapter list
- **Layout**:
  - Custom header with back button (left), bookmark/share icons (right)
  - Transparent header over cover banner
  - Scrollable content area with parallax cover effect
  - Floating "Start Reading" / "Continue" button at bottom
  - Safe area insets: bottom = insets.bottom + Spacing.xl
- **Components**:
  - Large cover image with blur background
  - Title, author, status, rating
  - Genre tags (horizontal scroll chips)
  - Synopsis (expandable with "Read More")
  - Chapter list (grouped by volume if applicable)
  - Chapter items show: number, title, date, read/unread indicator

### 5. Chapter Reader Screen (Modal Stack)
- **Purpose**: Read manga pages
- **Layout**:
  - Immersive full-screen experience
  - Tap to toggle UI overlay
  - Top overlay: Translucent header with chapter title, close button
  - Bottom overlay: Page indicator, previous/next chapter buttons
  - Safe area insets handled by overlay transparency
- **Components**:
  - Vertical scrolling for pages (default)
  - Horizontal paging mode option (Settings)
  - Zoom and pan gestures enabled
  - Loading indicator per page
  - Double-tap to zoom fit/full
  - Page counter: "Page 12 / 24"
  - Reader settings button: brightness, reading mode, page orientation

### 6. Profile/Settings Screen
- **Purpose**: Manage account and app preferences
- **Layout**:
  - Standard header with title "Profile"
  - Scrollable form with sections
  - Safe area insets: top = Spacing.xl, bottom = tabBarHeight + Spacing.xl
- **Components**:
  - Account section (if authenticated): Avatar, username, logout button
  - Guest mode: "Sign in to MangaDex" button
  - Reading preferences: Default reading mode, page transition
  - App preferences: Theme (light/dark/auto), notifications
  - About: Version, licenses, privacy policy

## Design System

### Color Palette
- **Primary**: Deep purple/indigo (#5C42C3) - for CTAs and active states
- **Background**: 
  - Light mode: #FFFFFF
  - Dark mode: #121212 (strongly recommended default for manga reading)
- **Surface**:
  - Light: #F5F5F5
  - Dark: #1E1E1E
- **Text**:
  - Light mode: #212121 (primary), #757575 (secondary)
  - Dark mode: #FFFFFF (primary), #B0B0B0 (secondary)
- **Reader Background**: Pure black (#000000) for immersive reading
- **Accent**: Warm orange (#FF6B35) for "Continue Reading" and progress indicators

### Typography
- **Headlines**: System bold, 24-28pt
- **Manga Titles**: System semibold, 16-18pt
- **Body**: System regular, 14-16pt
- **Captions**: System regular, 12-14pt, secondary color

### Visual Design
- **Manga Cover Cards**:
  - Aspect ratio: 2:3 (standard manga cover)
  - Rounded corners: 8px
  - Bottom gradient overlay for title visibility
  - No drop shadow; use subtle border in light mode
- **Floating Action Button** (Continue Reading):
  - Circular, 56x56dp
  - Accent color background
  - Book/play icon in white
  - Position: Bottom right, 16dp from edges
  - Shadow: shadowOffset {width: 0, height: 2}, shadowOpacity: 0.10, shadowRadius: 2
- **Reader UI Overlays**:
  - Semi-transparent backgrounds (#000000 with 70% opacity)
  - Fade in/out animations (200ms)
  - Auto-hide after 3 seconds of no interaction
- **Chapter List Items**:
  - Unread chapters: Bold text, colored indicator dot
  - Read chapters: Regular text, gray
  - Downloading: Progress bar overlay
- **Icons**: Use Feather icons from @expo/vector-icons for all UI actions

### Critical Assets
1. **App Logo**: Stylized book/manga icon (generate minimalist line art version)
2. **Empty State Illustrations**:
   - Search: Magnifying glass with floating manga pages
   - Library empty: Empty bookshelf
   - No internet: Disconnected cable/manga page
3. **Default Cover**: Gray placeholder with book icon when API image fails to load

### Accessibility & Interaction
- All touchable manga cards: Scale down to 0.95 on press
- Buttons: Opacity 0.6 on press
- Reader gestures: Single tap = toggle UI, double tap = zoom, swipe = next page
- Minimum touch target: 44x44pt for all interactive elements
- Support VoiceOver/TalkBack for navigation and manga titles
- High contrast mode support for text overlays