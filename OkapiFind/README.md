# OkapiFind

A React Native app built with Expo for finding and tracking items using location services, voice directions, and haptic feedback.

## Prerequisites

- Node.js (v20.19.4 or higher recommended)
- npm or yarn
- Expo CLI
- EAS CLI for building and deploying
- iOS Simulator (Mac only) or Android Emulator
- Expo Go app on your physical device (for testing)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Install EAS CLI globally (if not already installed)

```bash
npm install -g eas-cli
```

### 3. Login to your Expo account

```bash
eas login
```

### 4. Configure your project for EAS Build

```bash
eas build:configure
```

This will update the `projectId` in app.json with your actual project ID.

## Running the Development Server

```bash
# Start the Expo development server
npx expo start

# Or use npm script
npm start
```

Then:
- Press `i` to open iOS simulator
- Press `a` to open Android emulator
- Scan the QR code with Expo Go app on your phone

## Building for App Stores

### iOS Build

#### Development Build
```bash
eas build --profile development --platform ios
```

#### Preview Build (TestFlight)
```bash
eas build --profile preview --platform ios
```

#### Production Build (App Store)
```bash
eas build --profile production --platform ios
```

### Android Build

#### Development Build
```bash
eas build --profile development --platform android
```

#### Preview Build (Internal Testing)
```bash
eas build --profile preview --platform android
```

#### Production Build (Google Play)
```bash
eas build --profile production --platform android
```

## Submitting to App Stores

### Submit to Apple App Store
```bash
eas submit --platform ios
```

### Submit to Google Play Store
```bash
eas submit --platform android
```

## Project Structure

```
OkapiFind/
├── src/
│   ├── screens/      # Screen components
│   ├── components/   # Reusable components
│   ├── hooks/        # Custom React hooks
│   └── utils/        # Utility functions
├── assets/           # Images, fonts, and other assets
├── app.json         # Expo configuration
├── eas.json         # EAS Build configuration
├── App.tsx          # Main application component
└── tsconfig.json    # TypeScript configuration
```

## Key Features

- **Location Services**: Real-time location tracking using `expo-location`
- **Maps Integration**: Interactive maps with `react-native-maps`
- **Voice Directions**: Audio feedback using `expo-speech`
- **Haptic Feedback**: Tactile responses using `expo-haptics`
- **Navigation**: Stack navigation with `react-navigation`

## Configuration

### App Configuration
The app is configured in `app.json` with:
- Bundle ID: `com.okapi.find`
- iOS and Android specific settings
- Required permissions for location, microphone, and haptics

### Build Configuration
Build settings are defined in `eas.json` with three profiles:
- `development`: For local development with dev client
- `preview`: For internal testing
- `production`: For app store releases

## Troubleshooting

### Node Version Issues
If you see warnings about Node version, ensure you're using Node.js v20.19.4 or higher:
```bash
node --version
```

### EAS Build Issues
1. Ensure you're logged in: `eas whoami`
2. Check build status: `eas build:list`
3. View build logs: `eas build:view`

### Permissions Issues
Make sure all required permissions are properly configured in `app.json`:
- Location permissions for iOS and Android
- Microphone permission for voice features
- Vibration permission for haptic feedback

## License

[Add your license information here]

## Support

[Add your support contact information here]