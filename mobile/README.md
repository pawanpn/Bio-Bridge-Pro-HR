# BioBridge Pro HR - Mobile App

React Native mobile companion app for BioBridge Pro HR desktop application.

## Tech Stack
- **Expo SDK 52** - Cross-platform framework
- **React Native 0.76** - Native UI components
- **NativeWind (Tailwind)** - Styling
- **Expo Router** - File-based routing
- **TypeScript** - Type safety

## Features
✅ Dashboard with real-time stats
✅ Attendance check-in/out
✅ Leave management (apply, track)
✅ Language switcher (English/Nepali)
✅ Dark mode support
✅ Push notifications ready

## Setup

```bash
cd mobile
npm install
npm start
```

## Play Store Publishing

### 1. Install EAS CLI
```bash
npm install -g eas-cli
eas login
eas build:configure
```

### 2. Build APK (for testing)
```bash
npm run build:preview
```

### 3. Build AAB (for Play Store)
```bash
npm run build:android
```

### 4. Submit to Play Store
```bash
eas submit --platform android
```

## Project Structure
```
mobile/
├── app/
│   ├── (tabs)/          # Tab navigation screens
│   │   ├── _layout.tsx  # Tab bar config
│   │   ├── index.tsx    # Dashboard
│   │   ├── attendance.tsx
│   │   ├── leaves.tsx
│   │   └── settings.tsx
│   └── _layout.tsx      # Root layout
├── src/
│   └── context/
│       └── LanguageContext.tsx  # i18n
├── app.json             # Expo config
├── eas.json             # EAS build config
└── package.json
```

## Language Support
Currently supports **English** and **Nepali (नेपाली)**.
Add more languages in `src/context/LanguageContext.tsx`.

## API Integration
Connect to the Tauri desktop backend via:
- WebSocket for real-time sync
- REST API endpoints
- Direct SQLite database access (offline mode)
