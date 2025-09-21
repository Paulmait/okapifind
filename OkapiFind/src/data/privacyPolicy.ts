export const PRIVACY_POLICY = `
# Privacy Policy for OkapiFind

**Effective Date:** September 17, 2025
**Last Updated:** September 17, 2025

Cien Rios LLC, doing business as OkapiFind ("OkapiFind," "we," "our," or "us"), is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and protect information when you use the OkapiFind mobile application.

## 1. Information We Collect

**Location Data:** To help you find your parked car, we collect location data while the app is in use.

**Camera Access:** When you choose to take a photo of a parking meter or sign, we process that photo to extract parking information (using OCR).

**Notifications:** We send reminders about parking timers and safety alerts if you enable notifications.

**Account Information:** If you sign in with Google or Apple, we collect your name, email, and unique user ID.

**Payment Information:** Subscription purchases are handled securely by Apple App Store, Google Play, and RevenueCat. We do not store credit card details.

## 2. How We Use Your Information

• To provide navigation and parking timer services.
• To send alerts and reminders you have requested.
• To manage subscriptions and verify Premium access.
• To improve features and user experience.

## 3. Data Sharing

**Service Providers:** We may share data with trusted providers like Firebase, Google, Apple, and RevenueCat for authentication, payments, and analytics.

**Legal Compliance:** We may disclose information if required by law.

**No Sale of Data:** We do not sell or rent your personal information to third parties.

## 4. Data Security

We implement industry-standard security measures to protect your data, including encryption in transit and secure storage.

## 5. Your Rights

You may:
• Access, update, or delete your account information at any time.
• Disable location or camera permissions in your device settings.
• Cancel your subscription through the App Store or Google Play.

## 6. Children's Privacy

OkapiFind is not directed to children under 13. We do not knowingly collect personal information from children.

## 7. Contact Us

If you have questions, contact:

**Cien Rios LLC – Privacy Team**
Email: support@okapifind.com
Phone: +1 (305) 814-1252
Address: 3350 SW 148th Ave, Suite 110, Miramar, FL 33027
`;

export const getPrivacyPolicy = (): string => {
  return PRIVACY_POLICY;
};

export const PRIVACY_POLICY_VERSION = '1.0.0';
export const PRIVACY_POLICY_LAST_UPDATED = 'September 17, 2025';