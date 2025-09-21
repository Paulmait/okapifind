# OkapiFind - App Store Compliance Documentation

## Company Information
- **Company Name**: Cien Rios LLC
- **DBA**: OkapiFind
- **Contact Email**: support@okapifind.com
- **Business Address**: 3350 SW 148th Ave, Suite 110, Miramar, FL 33027
- **Business Phone**: +1 (305) 814-1252

## App Information
- **App Name**: OkapiFind
- **Tagline**: Never lose your car
- **Category**: Navigation
- **Bundle ID**: com.okapi.find

## Privacy & Data Collection

### Data Types Collected
1. **Location Data**
   - Purpose: Navigation to parked car
   - Storage: Local device only (AsyncStorage)
   - Sharing: None

2. **Camera Access** (when implemented)
   - Purpose: OCR for parking signs/meters
   - Storage: Processed locally, images not stored
   - Sharing: None

3. **Account Data** (optional)
   - Purpose: Authentication and subscription management
   - Storage: Firebase/Google/Apple servers
   - Sharing: Only with authentication providers

### Privacy Policy Compliance
- Privacy Policy URL: In-app accessible
- Last Updated: September 17, 2025
- GDPR Compliant: Yes
- CCPA Compliant: Yes
- COPPA Compliant: Yes (App not directed to children under 13)

## Permissions Required

### iOS Info.plist Keys
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>OkapiFind needs access to your location to help you find items.</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>OkapiFind needs access to your location to help you find items.</string>

<key>NSMicrophoneUsageDescription</key>
<string>OkapiFind needs access to your microphone for voice directions.</string>
```

### Android Permissions
```xml
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.VIBRATE" />
```

## App Store Requirements

### Apple App Store
1. **Age Rating**: 4+
2. **Content Descriptors**: None
3. **Export Compliance**: Uses standard encryption (HTTPS)
4. **IDFA**: Not used
5. **Third-party Content**: None
6. **Sign in with Apple**: Supported (when implemented)

### Google Play Store
1. **Content Rating**: Everyone
2. **Target Audience**: 18+ (drivers)
3. **Ads**: None
4. **In-app Purchases**: Premium subscription (when implemented)
5. **Data Safety Section**:
   - Location: Collected, not shared
   - Personal info: Optional (auth only)
   - Data encrypted in transit: Yes
   - Data deletion available: Yes

## Subscription Information (Future)
- **Premium Features**: Advanced parking detection, unlimited saves
- **Pricing**: TBD
- **Billing**: Via App Store/Google Play
- **Payment Processor**: RevenueCat
- **Auto-renewal**: Yes
- **Free Trial**: 7 days

## Legal Compliance

### Terms of Service
- Effective Date: September 17, 2025
- Governing Law: State of Florida, USA
- Liability Limitations: Included
- User Responsibilities: Defined

### Safety Disclaimers
- Not for use while driving
- User responsible for parking compliance
- No guarantee of parking availability
- Safety is user's responsibility

## Testing Accounts
For app review, provide:
- Test account: review@okapifind.com
- Test password: [Generate for review]
- Demo mode: Available

## Support Information
- Support Email: support@okapifind.com
- Support URL: https://okapifind.com/support
- Response Time: Within 24 hours

## App Store Descriptions

### Short Description (80 chars)
"Never lose your parked car again. Smart parking detection & navigation guide."

### Long Description
OkapiFind helps you effortlessly find your parked car with intelligent parking detection and turn-by-turn guidance.

**Key Features:**
• Automatic Parking Detection - Detects when you park and saves location
• Voice Navigation - Get spoken directions to your car
• Haptic Feedback - Feel vibrations when you're close
• Frequent Locations - Remembers your favorite parking spots
• Manual Save - Quickly mark your parking location
• Privacy First - All data stays on your device

**How It Works:**
1. Park your car normally
2. OkapiFind automatically detects and saves the location
3. When ready to return, open the app for guided navigation
4. Follow the compass arrow or voice directions
5. Get haptic feedback when you're close

Perfect for:
• Shopping centers and malls
• Airports and train stations
• Large parking lots
• Street parking in cities
• Theme parks and venues

No account required. Optional premium features available.

**Privacy & Security:**
- No data sharing with third parties
- Location data stays on your device
- Optional cloud backup with encryption
- Full user control over all settings

Developed by Cien Rios LLC. Never lose your car again with OkapiFind!

## Keywords
parking, car finder, vehicle locator, parking assistant, navigation, compass, GPS tracker, parking spot, find my car, parking reminder

## Screenshots Required
1. Map view with car location
2. Compass navigation screen
3. Auto-detection notification
4. Settings screen
5. Voice guidance in action

## App Icon
- 1024x1024 PNG without transparency
- Follow iOS Human Interface Guidelines
- Include car and navigation elements

## Version History
- v1.0.0: Initial release with core features
  - Automatic parking detection
  - Manual location saving
  - Voice and haptic guidance
  - Privacy-focused design

## Certification
This app complies with:
- Apple App Store Guidelines
- Google Play Developer Policies
- GDPR (European Privacy)
- CCPA (California Privacy)
- ADA (Accessibility standards)

## Notes for Reviewers
- Location permission is essential for core functionality
- No ads or tracking
- All features work offline
- Premium features are optional
- Family-friendly content