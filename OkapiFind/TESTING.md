# Testing OkapiFind with Expo Go

## Prerequisites
- Install Expo Go app on your phone (iOS or Android)
- Make sure your phone and development machine are on the same network

## Start the Development Server

1. Navigate to the project directory:
```bash
cd OkapiFind
```

2. Start the Expo development server:
```bash
npx expo start
```

Or use the npm script:
```bash
npm start
```

## Testing on Your Device

### Using QR Code (Recommended)
1. After running `npx expo start`, a QR code will appear in the terminal
2. **iOS**: Open Camera app and scan the QR code
3. **Android**: Open Expo Go app and tap "Scan QR Code"

### Manual Connection
1. Open Expo Go app on your phone
2. Look for your project under "Development servers"
3. Tap on your project to open it

## Testing Features

### Map Screen
1. App will request location permissions - Grant them
2. You should see a map with your current location
3. Test "Set Car Location" button - saves your current position
4. Car location marker should appear on the map

### Guidance Screen
1. After setting car location, tap "Guide Me"
2. You'll see:
   - Compass with arrow pointing to car
   - Distance display (tap to toggle metric/imperial)
   - Voice guidance toggle
3. Test features:
   - Walk around to see compass update
   - Enable voice guidance for audio directions
   - Get within 20 feet of saved location for haptic feedback

## Troubleshooting

### "Network response timed out"
- Ensure phone and computer are on same WiFi
- Try using tunnel connection: `npx expo start --tunnel`

### Location not working
- Check phone's location settings
- Ensure location services are enabled for Expo Go

### Map not showing
- Maps work best on physical devices, not simulators
- Android: Google Maps should work automatically
- iOS: Apple Maps will be used

### Voice/Haptics not working
- These features require a physical device
- Won't work in web browser or some simulators

## Common Commands

```bash
# Start with clear cache
npx expo start -c

# Start for specific platform
npm run ios     # iOS only
npm run android # Android only

# Check for issues
npx expo-doctor

# Update dependencies
npx expo install --check
```

## Build for Production

When ready to build for app stores:
```bash
# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

## Notes
- The app uses a mock car location initially (San Francisco)
- Car location persists between app sessions using AsyncStorage
- All permissions are properly configured in app.json