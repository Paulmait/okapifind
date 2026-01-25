# OkapiFind - App Store Resubmission Guide

## Apple Review Rejection Summary (January 20, 2026)

| Issue | Guideline | Status | Action Required |
|-------|-----------|--------|-----------------|
| In-App Purchases not submitted | 2.1 | NEEDS FIX | Submit IAPs in App Store Connect |
| Age Rating "In-App Controls" incorrect | 2.3.6 | NEEDS FIX | Set Age Assurance to "None" |
| iPad screenshots show iPhone images | 2.3.3 | NEEDS FIX | Generate proper iPad screenshots |
| Terms of Use link missing | 3.1.2 | NEEDS FIX | Add Terms URL to metadata |

---

## STEP 0: Enable Premium Test Mode (For Screenshots)

Before capturing screenshots for the IAP review, enable premium test mode on your device:

### 0.1 Enable Developer Mode in the App

1. Open OkapiFind on your iPhone
2. Go to **Settings** (gear icon)
3. Scroll down to the **About** section
4. Tap on **"Version 1.0.0"** rapidly **7 times**
5. You'll see an alert: "Developer mode enabled!"

### 0.2 Enable Premium Test Mode

1. After enabling developer mode, scroll down to see **Developer Options**
2. Toggle **"Premium Test Mode"** to ON
3. Close and restart the app
4. Premium features are now unlocked for testing!

### 0.3 Capture Required Screenshots

With premium mode enabled, navigate to the **Paywall Screen** to capture screenshots:

1. Go to Settings > Upgrade to Premium (or trigger paywall from any premium feature)
2. Take a screenshot showing the subscription options
3. This screenshot will be used for IAP review

**Screenshot location for upload:** The captured screenshot from your device.

---

## STEP 1: Fix In-App Purchases (Guideline 2.1)

The app references Premium Subscriptions but the IAPs haven't been submitted for review.

### 1.1 Go to App Store Connect

1. Open [App Store Connect](https://appstoreconnect.apple.com)
2. Select **OkapiFind** app
3. Go to **Features** > **In-App Purchases**

### 1.2 Create/Verify Subscription Group

1. Click **Manage** under Subscription Groups
2. Create group if not exists: **OkapiFind Premium**
3. Set **Reference Name**: `OkapiFind Premium Subscriptions`

### 1.3 Configure Each Product

For each product, ensure ALL required fields are completed:

#### Product 1: Premium Monthly
| Field | Value |
|-------|-------|
| Reference Name | Premium Monthly |
| Product ID | `com.okapi.find.premium.monthly` |
| Type | Auto-Renewable Subscription |
| Duration | 1 Month |
| Price | $2.99 USD (Tier 3) |
| **Display Name** | Premium Monthly |
| **Description** | Unlimited parking saves, photo notes, full parking history, and safety sharing. Cancel anytime. |

#### Product 2: Premium Annual
| Field | Value |
|-------|-------|
| Reference Name | Premium Annual |
| Product ID | `com.okapi.find.premium.annual` |
| Type | Auto-Renewable Subscription |
| Duration | 1 Year |
| Price | $19.99 USD (Tier 20) |
| **Display Name** | Premium Annual |
| **Description** | Unlimited parking saves, photo notes, full parking history, and safety sharing. Best value - save 44% vs monthly! |

#### Product 3: Premium Lifetime
| Field | Value |
|-------|-------|
| Reference Name | Premium Lifetime |
| Product ID | `com.okapi.find.premium.lifetime` |
| Type | Non-Consumable |
| Price | $39.99 USD |
| **Display Name** | Premium Lifetime |
| **Description** | One-time purchase. All premium features forever - unlimited saves, photo notes, history, and safety sharing. |

### 1.4 Add Required Screenshots for Each IAP

For EACH in-app purchase product:

1. Click on the product
2. Scroll to **App Store Promotion** section
3. Click **Add Screenshot** under "Review Screenshot"
4. Upload a screenshot showing the purchase UI (use Paywall screen screenshot)
5. Screenshot requirements:
   - iPhone: 640x920 or 750x1334 pixels
   - Must show the IAP in context within the app

**Use this screenshot:** `assets/app-store/ios/screenshots/6.7-inch/05-premium-paywall.png`

### 1.5 Submit Products for Review

1. For each product, click **Submit for Review**
2. Status should change from "Missing Metadata" to "Waiting for Review"
3. Products will be reviewed with the next app submission

---

## STEP 2: Fix Age Rating (Guideline 2.3.6)

Apple found that "In-App Controls" (Parental Controls/Age Assurance) was selected but not present in the app.

### 2.1 Update Age Rating in App Store Connect

1. Go to **App Store Connect** > **OkapiFind**
2. Click **App Information** (left sidebar)
3. Scroll to **Age Rating**
4. Click **Edit** next to the age rating

### 2.2 Update Age Assurance Setting

| Question | Correct Answer |
|----------|----------------|
| Age Assurance | **None** |
| Parental Controls | **None** |

All other age rating questions should remain as "None":
- [ ] Cartoon or Fantasy Violence: None
- [ ] Realistic Violence: None
- [ ] Prolonged Graphic or Sadistic Violence: None
- [ ] Profanity or Crude Humor: None
- [ ] Mature/Suggestive Themes: None
- [ ] Horror/Fear Themes: None
- [ ] Medical/Treatment Information: None
- [ ] Alcohol, Tobacco, or Drug Use: None
- [ ] Simulated Gambling: None
- [ ] Sexual Content or Nudity: None
- [ ] Unrestricted Web Access: No
- [ ] Gambling with Real Currency: No
- [x] **Age Assurance: None** (CHANGE THIS)
- [x] **Parental Controls: None** (CHANGE THIS)

3. Click **Save**

**Expected Result:** Age Rating should be **4+**

---

## STEP 3: Fix iPad Screenshots (Guideline 2.3.3)

Apple rejected because 13-inch iPad screenshots show iPhone images, not proper iPad app screenshots.

### 3.1 Generate Proper iPad Screenshots

Run the iPad screenshot generator:

```bash
cd OkapiFind
npm install sharp  # If not already installed
node scripts/generate-ipad-screenshots.js
```

This will generate proper full-screen iPad screenshots from the iPhone screenshots.

### 3.2 Verify Generated Screenshots

Check that these files were created:

```
assets/app-store/ios/screenshots/ipad-13/
  ├── 01-home-map.png        (2048x2732)
  ├── 02-floor-selector.png  (2048x2732)
  ├── 03-location-saved.png  (2048x2732)
  ├── 04-settings-features.png (2048x2732)
  ├── 05-premium-paywall.png (2048x2732)
  └── 06-settings-legal.png  (2048x2732)

assets/app-store/ios/screenshots/ipad-11/
  ├── 01-home-map.png        (1668x2388)
  ├── 02-floor-selector.png  (1668x2388)
  ├── 03-location-saved.png  (1668x2388)
  ├── 04-settings-features.png (1668x2388)
  ├── 05-premium-paywall.png (1668x2388)
  └── 06-settings-legal.png  (1668x2388)
```

### 3.3 Upload to App Store Connect

1. Go to **App Store Connect** > **OkapiFind** > **App Store** tab
2. Scroll to **Screenshots** section
3. Click **View All Sizes in Media Manager** (important!)
4. Select **iPad Pro (6th Gen) 12.9"** tab
5. **Delete all existing screenshots** (they show iPhone mockups)
6. Upload new screenshots from `assets/app-store/ios/screenshots/ipad-13/`
7. Repeat for **iPad Pro 11"** using `ipad-11/` folder screenshots
8. Click **Save**

### 3.4 Screenshot Requirements Checklist

- [ ] Screenshots show app in full-screen iPad layout
- [ ] No iPhone device mockups in iPad screenshots
- [ ] Minimum 2 screenshots, maximum 10
- [ ] PNG or JPEG format
- [ ] Correct dimensions (2048x2732 for 12.9", 1668x2388 for 11")

---

## STEP 4: Add Terms of Use Link (Guideline 3.1.2)

Apple requires a functional Terms of Use (EULA) link for apps with subscriptions.

### 4.1 Terms of Use URL (VERIFIED LIVE)

Use these URLs (verified working on Vercel):

| Document | URL |
|----------|-----|
| **Terms of Service** | `https://okapifind.com/terms` |
| **Privacy Policy** | `https://okapifind.com/privacy` |

### 4.2 Add to App Store Description

1. Go to **App Store Connect** > **OkapiFind** > **App Store** tab
2. Under the version, find **Description** field
3. Ensure the description ends with:

```
---
Support: https://github.com/Paulmait/okapifind/issues
Privacy Policy: https://okapifind.com/privacy
Terms of Service: https://okapifind.com/terms
```

### 4.3 Add Custom EULA (Optional but Recommended)

1. Go to **App Store Connect** > **OkapiFind**
2. Click **App Information** (left sidebar)
3. Scroll to **License Agreement**
4. Select **Custom App License Agreement**
5. Paste the contents of `TERMS_OF_SERVICE.md`
6. Click **Save**

### 4.4 Verify Subscription Info Text

The PaywallScreen already includes Terms links. Verify in app:
- "By subscribing, you agree to our Terms of Service and Privacy Policy"
- Both links must be tappable and work

---

## STEP 5: Resubmit for Review

### 5.1 Pre-Submission Checklist

Complete ALL items before resubmitting:

#### In-App Purchases (Guideline 2.1)
- [ ] Monthly subscription has Display Name and Description
- [ ] Annual subscription has Display Name and Description
- [ ] Lifetime purchase has Display Name and Description
- [ ] Each IAP has a Review Screenshot uploaded
- [ ] All IAPs show status "Ready to Submit" or "Waiting for Review"
- [ ] Subscription group "OkapiFind Premium" is configured

#### Age Rating (Guideline 2.3.6)
- [ ] Age Assurance set to "None"
- [ ] Parental Controls set to "None"
- [ ] Age Rating shows as 4+

#### iPad Screenshots (Guideline 2.3.3)
- [ ] iPad Pro 12.9" screenshots regenerated (2048x2732)
- [ ] iPad Pro 11" screenshots regenerated (1668x2388)
- [ ] All iPad screenshots show full-screen app (not iPhone mockups)
- [ ] Screenshots uploaded to App Store Connect

#### Terms of Use (Guideline 3.1.2)
- [ ] Terms URL added to app description
- [ ] Terms URL is accessible (test in browser)
- [ ] Privacy Policy URL is accessible
- [ ] Custom EULA added (optional)

### 5.2 Build New Version (Optional)

If you made code changes:

```bash
cd OkapiFind

# Increment build number
# Edit app.config.js: "buildNumber": "10" (increment from 9)

# Build for iOS
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios --latest
```

### 5.3 If No Code Changes

If only App Store Connect metadata was changed:

1. Go to **App Store Connect** > **OkapiFind**
2. Click on the version under **iOS App**
3. Scroll down and click **Add for Review**
4. Answer compliance questions
5. Click **Submit for Review**

---

## STEP 6: Reply to Apple

After making all fixes, reply to Apple in App Store Connect:

### Sample Reply Message

```
Hello App Review Team,

Thank you for the detailed feedback. We have addressed all the issues:

1. **Guideline 2.1 (In-App Purchases)**: All three subscription products now have complete metadata including Display Names, Descriptions, and Review Screenshots. They have been submitted for review.

2. **Guideline 2.3.6 (Age Rating)**: We have updated the Age Rating settings. "Age Assurance" and "Parental Controls" are now set to "None" as our app does not include these features.

3. **Guideline 2.3.3 (iPad Screenshots)**: We have replaced the iPad screenshots with proper full-screen iPad app captures that accurately show the app as it appears on iPad devices.

4. **Guideline 3.1.2 (Terms of Use)**: We have added the Terms of Service URL to the app description and configured a Custom App License Agreement.

Please review our updated submission at your convenience.

Best regards,
OkapiFind Team
```

---

## Troubleshooting

### IAP Products Show "Missing Metadata"

1. Ensure Display Name is filled (localized if needed)
2. Ensure Description is filled (localized if needed)
3. Upload a Review Screenshot for each product
4. Save and refresh the page

### iPad Screenshots Not Uploading

1. Verify dimensions: 2048x2732 (12.9") or 1668x2388 (11")
2. Use PNG or JPEG format
3. File size under 500MB
4. Try "View All Sizes in Media Manager" to access iPad slots

### Terms URL Returns 404

1. Verify the file exists in the repository
2. Use raw GitHub URL if needed:
   ```
   https://raw.githubusercontent.com/Paulmait/okapifind/main/TERMS_OF_SERVICE.md
   ```
3. Or deploy to GitHub Pages for cleaner URL

---

## Expected Timeline

| Action | Time |
|--------|------|
| Fix metadata in App Store Connect | 1-2 hours |
| Generate iPad screenshots | 5 minutes |
| Upload screenshots | 15 minutes |
| Apple review (resubmission) | 24-48 hours |

---

## Contact

If issues persist:
- App Store Connect Messages (preferred)
- Apple Developer Support: https://developer.apple.com/contact/

---

**Document Version:** 1.0
**Created:** January 25, 2026
**For App Version:** 1.0.0 (Build 10+)
