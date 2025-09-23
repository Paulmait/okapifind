# App Store Requirements - OkapiFind

This document outlines the comprehensive requirements for submitting OkapiFind to both Apple App Store and Google Play Store.

## Table of Contents

1. [Apple App Store Requirements](#apple-app-store-requirements)
2. [Google Play Store Requirements](#google-play-store-requirements)
3. [Common Requirements](#common-requirements)
4. [Revenue Features Compliance](#revenue-features-compliance)
5. [Privacy & Legal Requirements](#privacy--legal-requirements)
6. [Pre-Submission Checklist](#pre-submission-checklist)

## Apple App Store Requirements

### App Store Review Guidelines Compliance

#### 1. Safety (Guideline 1)
- ✅ **Objectionable Content**: No offensive content, violence, or inappropriate material
- ✅ **User Generated Content**: Parking photos are user-generated but limited to parking locations
- ✅ **Kids Category**: Not targeting children under 13
- ✅ **Physical Harm**: App promotes safe driving practices
- ✅ **Developer Information**: Complete and accurate developer profile

#### 2. Performance (Guideline 2)
- ✅ **App Completeness**: Fully functional app with all features working
- ✅ **Beta Testing**: Comprehensive testing via TestFlight
- ✅ **Accurate Metadata**: App description matches functionality
- ✅ **Hardware Compatibility**: Works on all supported iOS devices
- ✅ **Software Requirements**: iOS 13.0+ compatibility
- ✅ **Network Requirements**: Graceful offline mode handling

#### 3. Business (Guideline 3)
- ✅ **Payments**: Uses App Store's in-app purchase system for subscriptions
- ✅ **Other Business Model Issues**: Clear pricing and subscription terms
- ✅ **Gaming and Contests**: Not applicable
- ✅ **VPN Apps**: Not applicable
- ✅ **Mobile Device Management**: Not applicable

#### 4. Design (Guideline 4)
- ✅ **Copycats**: Original app concept and design
- ✅ **Minimum Functionality**: Substantial functionality beyond basic utilities
- ✅ **Spam**: Not a spam app, provides genuine parking value
- ✅ **Extensions**: No app extensions currently
- ✅ **Apple Sites and Services**: Proper use of Apple services

#### 5. Legal (Guideline 5)
- ✅ **Privacy**: Comprehensive privacy policy and compliance
- ✅ **Intellectual Property**: No copyright infringement
- ✅ **Gaming Rules**: Not applicable
- ✅ **VPN Apps**: Not applicable
- ✅ **Mobile Device Management**: Not applicable

### Specific Requirements for OkapiFind

#### Location Services
- **Purpose**: Clear explanation of why location is needed
- **Permission Timing**: Request location permission contextually
- **Accuracy**: Use appropriate location accuracy for parking detection
- **Background Usage**: Justified background location usage for parking detection

#### Camera Usage
- **Purpose**: Taking photos of parking spots for memory aids
- **Permission**: Request camera permission when user wants to take photo
- **Storage**: Photos stored locally and optionally in user's photo library

#### Notifications
- **Purpose**: Parking reminders and timer notifications
- **Permission**: Smart permission request strategy (after value demonstration)
- **Content**: Relevant parking-related notifications only

#### Subscription Model
- **Clear Pricing**: Transparent subscription costs and billing periods
- **Free Trial**: Clear trial terms and auto-renewal disclosure
- **Cancellation**: Easy cancellation process
- **Restore Purchases**: Functional restore purchases mechanism

### App Store Metadata Requirements

#### App Information
- **Name**: OkapiFind - Smart Parking
- **Subtitle**: Never Forget Where You Parked
- **Category**: Navigation
- **Content Rating**: 4+ (no objectionable content)
- **Price**: Free (with in-app purchases)

#### Localization
- **Primary Language**: English
- **Additional Languages**: Spanish, French (future releases)

#### Keywords
```
parking, car finder, navigation, auto detection, smart parking, location, GPS, parking timer, parking reminder, find my car
```

#### App Description
```
OkapiFind is the smartest way to never lose your car again! Our advanced parking detection automatically saves your parking location when you park, making it effortless to find your car later.

KEY FEATURES:
🅿️ Automatic Parking Detection - No need to remember to save your spot
📍 GPS Navigation - Get turn-by-turn directions back to your car
📷 Photo Memory - Take photos to remember parking details
⏰ Parking Timers - Set reminders for meter expiration
🔍 Smart Search - Find nearby parking or your saved spots
🎯 Precision Accuracy - Pinpoint location with advanced algorithms

PREMIUM FEATURES:
• Unlimited parking history
• Advanced auto-detection
• Custom parking notes
• Export parking data
• Priority customer support

Perfect for:
• Daily commuters
• City drivers
• Shopping mall visits
• Airport parking
• Event parking
• Travel and tourism

Download OkapiFind today and never wander around looking for your car again!
```

#### Screenshots Requirements
- **6.7" Display**: iPhone 14 Pro Max screenshots (mandatory)
- **6.5" Display**: iPhone 14 Plus screenshots (mandatory)
- **5.5" Display**: iPhone 8 Plus screenshots (mandatory)
- **12.9" Display**: iPad Pro screenshots (if iPad supported)

#### App Preview Video
- **Duration**: 15-30 seconds
- **Content**: Show key features in action
- **Quality**: High resolution, clear audio
- **Captions**: Include captions for accessibility

### Technical Requirements

#### Bundle Information
- **Bundle Identifier**: `com.okapifind.app`
- **Version**: 1.0.0
- **Build Number**: Incremental (e.g., 1, 2, 3...)
- **Minimum OS**: iOS 13.0
- **Device Support**: iPhone, iPad (if universal)

#### Capabilities
- Location Services
- Camera
- Push Notifications
- Background App Refresh
- In-App Purchase

#### App Transport Security (ATS)
- HTTPS for all network communications
- Exception domains (if any) documented
- Certificate pinning for API calls

## Google Play Store Requirements

### Google Play Console Requirements

#### Store Listing
- **App Name**: OkapiFind - Smart Parking
- **Short Description**: Never forget where you parked again
- **Full Description**: (Same as iOS with Play Store formatting)
- **Category**: Maps & Navigation
- **Content Rating**: Everyone
- **Target Audience**: Ages 18+

#### Graphics Assets
- **App Icon**: 512 x 512 PNG
- **Feature Graphic**: 1024 x 500 PNG
- **Phone Screenshots**: At least 2, up to 8 (16:9 or 9:16 aspect ratio)
- **7-inch Tablet Screenshots**: Optional but recommended
- **10-inch Tablet Screenshots**: Optional but recommended
- **TV Screenshots**: Not applicable
- **Wear OS Screenshots**: Not applicable

#### Privacy Policy
- **URL Required**: Must be accessible and comprehensive
- **Content**: Cover all data collection and usage
- **GDPR Compliance**: For EU users
- **CCPA Compliance**: For California users

### Android Technical Requirements

#### Target API Level
- **Target SDK**: API 33 (Android 13) minimum
- **Compile SDK**: Latest stable Android SDK
- **Min SDK**: API 21 (Android 5.0) for broader compatibility

#### Permissions
```xml
<!-- Essential Permissions -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

<!-- Background Location (requires justification) -->
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />

<!-- Notifications -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

#### App Bundle
- **Format**: Android App Bundle (AAB) preferred over APK
- **Size**: Under 150MB for instant apps, no hard limit for regular apps
- **Architecture**: Support arm64-v8a, armeabi-v7a, x86, x86_64

#### Proguard/R8
- Enabled for release builds
- Proper obfuscation rules for expo/React Native
- Keep rules for critical libraries

### Content Rating Requirements

#### IARC Questionnaire
- **Violence**: None
- **Sexual Content**: None
- **Profanity**: None
- **Controlled Substances**: None
- **Gambling**: None
- **User Interaction**: Users can share location data
- **Data Collection**: Location, photos, analytics

## Common Requirements

### Privacy & Data Protection

#### Privacy Policy Requirements
Must cover:
- Location data collection and usage
- Photo storage and processing
- Analytics data collection
- Subscription and payment data
- Third-party services integration
- User rights and data deletion
- Cookie usage (if applicable)
- International data transfers

#### Data Handling Transparency
- **Data Types Collected**:
  - Location data (precise)
  - Photos (user-provided)
  - Usage analytics
  - Crash reports
  - Device identifiers
  - Subscription status

- **Data Usage Purposes**:
  - Core app functionality
  - Personalization
  - Analytics and performance
  - Customer support
  - Legal compliance

- **Data Sharing**:
  - Analytics providers (anonymized)
  - Crash reporting services
  - Payment processors
  - No third-party advertising

#### User Consent
- Clear opt-in for data collection
- Granular consent options where possible
- Easy opt-out mechanisms
- Regular consent renewal

### Accessibility Requirements

#### iOS Accessibility
- VoiceOver support
- Dynamic Type support
- Voice Control compatibility
- Switch Control support
- High contrast mode support

#### Android Accessibility
- TalkBack support
- Large text support
- High contrast mode
- Switch navigation
- Voice commands

### Subscription & Monetization

#### Subscription Terms
- **Free Trial**: 7 days free trial
- **Pricing**:
  - Monthly: $4.99/month
  - Annual: $39.99/year (33% savings)
- **Auto-renewal**: Clearly disclosed
- **Cancellation**: Available anytime
- **Refunds**: Follow platform policies

#### In-App Purchase Requirements
- Restore purchases functionality
- Receipt validation
- Offline graceful degradation
- Clear feature restrictions for free users

## Revenue Features Compliance

### Review Prompt Service
- **iOS**: Uses StoreReview.requestReview() (compliant)
- **Timing**: After 3 parking saves (follows best practices)
- **Frequency**: Respects iOS limits (3 times per year)
- **Android**: Custom prompt directing to Play Store

### Referral Program
- **Compliance**: No violation of app store policies
- **Rewards**: Premium subscription time (legitimate value)
- **Tracking**: Uses proper attribution methods
- **Fraud Prevention**: Validates referral authenticity

### Win-back Campaigns
- **Email Marketing**: Uses external email service
- **Opt-out**: Required unsubscribe mechanism
- **Frequency**: Reasonable campaign spacing
- **Content**: Relevant to app functionality

### Notification Strategy
- **iOS**: Follows permission best practices
- **Android**: Complies with notification policies
- **Timing**: After value demonstration (day 3)
- **Content**: Parking-related only

## Pre-Submission Checklist

### Technical Verification
- [ ] App builds successfully for release
- [ ] All features work on target devices
- [ ] Location services work accurately
- [ ] Camera functionality works properly
- [ ] Notifications send and display correctly
- [ ] Subscription flow works end-to-end
- [ ] Offline mode handles gracefully
- [ ] App doesn't crash under normal usage
- [ ] Performance testing completed
- [ ] Memory leak testing completed

### Content Verification
- [ ] App description is accurate and compelling
- [ ] Screenshots show key features clearly
- [ ] App preview video demonstrates core functionality
- [ ] All text is proofread and professional
- [ ] Keywords are relevant and optimized
- [ ] Privacy policy is comprehensive and accessible
- [ ] Terms of service are clear and fair

### Legal Verification
- [ ] Privacy policy covers all data collection
- [ ] Terms of service are legally compliant
- [ ] Subscription terms are clear and fair
- [ ] All required disclosures are present
- [ ] Copyright and trademark compliance verified
- [ ] Age rating is appropriate
- [ ] Content rating questionnaire completed accurately

### Store-Specific Requirements
#### iOS
- [ ] TestFlight beta testing completed
- [ ] All iOS Human Interface Guidelines followed
- [ ] App Store Review Guidelines compliance verified
- [ ] Metadata and keywords optimized
- [ ] Screenshots for all required device sizes
- [ ] App uses App Store Connect API properly

#### Android
- [ ] Internal testing track completed
- [ ] Material Design guidelines followed
- [ ] Google Play Developer Policy compliance verified
- [ ] Content rating completed
- [ ] Store listing optimized
- [ ] Android App Bundle generated

### Revenue Features Testing
- [ ] Review prompt triggers correctly
- [ ] Referral system tracks properly
- [ ] Notification permissions request appropriately
- [ ] Win-back campaigns configured
- [ ] Analytics events fire correctly
- [ ] Subscription flows work properly

### Final Pre-Submission
- [ ] Version numbers incremented correctly
- [ ] Release notes prepared
- [ ] Support contact information updated
- [ ] Marketing materials prepared
- [ ] Launch timeline coordinated
- [ ] Customer support prepared for inquiries

## Post-Submission Monitoring

### Key Metrics to Track
- Download/install rates
- User retention rates
- Subscription conversion rates
- Review ratings and feedback
- Crash rates and performance issues
- Feature usage analytics
- Revenue metrics

### Response Preparation
- Customer support for user issues
- Bug fix release plan
- Feature update roadmap
- Marketing campaign coordination
- Review response strategy

---

**Note**: This document should be reviewed and updated regularly as app store policies and requirements change. Always refer to the latest official documentation from Apple and Google before submission.

**Last Updated**: September 2025
**Next Review**: December 2025