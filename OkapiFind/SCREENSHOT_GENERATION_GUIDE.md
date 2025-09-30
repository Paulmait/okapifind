# Screenshot Generation Guide

## ⚠️ CRITICAL: Current Screenshots Are Placeholders

The existing screenshots in `assets/app-store/` are **marketing templates**, not actual app screenshots. Apple and Google **will reject** apps with fake/mockup screenshots.

**You MUST replace these with real app screenshots before submission.**

---

## 📋 What App Stores Require

### Apple App Store Guidelines
- Screenshots must show **actual app interface**
- No mockup devices or frames
- No marketing text overlays (except small captions)
- Must accurately represent app functionality
- **Rejection reason 2.3.7**: "Screenshots do not sufficiently reflect the app in use"

### Google Play Store Policy
- Screenshots must be **actual app captures**
- No misleading imagery
- Must show primary app functionality
- Accurate representation required

---

## 🎯 Required Screenshots (Actual App Interface)

### Screenshot 1: Main Map Screen (Car Saved)
**What to show:**
- Map view with user location (blue dot)
- Car marker (red pin with car icon)
- Distance indicator ("250m away")
- Big "FIND MY CAR" button
- Auto-detect toggle at bottom
- Clean, uncluttered interface

**How to capture:**
1. Open app and grant location permission
2. Tap "Set Car Location"
3. Move 100-200 meters away
4. Take screenshot showing map with both markers

**Label (optional caption):** "One tap to save your parking spot"

---

### Screenshot 2: Navigation View (Turn-by-Turn)
**What to show:**
- Turn-by-turn navigation active
- Route line from user to car
- ETA and distance
- "Next turn" instruction
- Traffic indicators (if available)

**How to capture:**
1. With car location saved, tap "FIND MY CAR"
2. Navigation starts automatically
3. Screenshot showing route and instructions

**Label (optional caption):** "Get directions back to your car"

---

### Screenshot 3: Photo Note Feature
**What to show:**
- Camera view or photo attached to parking location
- "Add Photo Note" interface
- Saved photo thumbnail
- Parking spot level/section info

**How to capture:**
1. After saving car location
2. Tap camera icon or "Add Photo"
3. Show photo attachment interface

**Label (optional caption):** "Remember exactly where you parked"

---

### Screenshot 4: Parking History
**What to show:**
- List of recent parking locations
- Timestamps ("2 hours ago", "Yesterday")
- Map thumbnails for each location
- Quick navigate button

**How to capture:**
1. Go to Settings or History
2. Show list of past parking spots
3. Clean scrollable list view

**Label (optional caption):** "Access your parking history"

---

### Screenshot 5: Settings/Subscription Screen
**What to show:**
- Free/Plus/Pro tier options
- Feature comparison
- Clean pricing display
- Current subscription status

**How to capture:**
1. Navigate to Settings → Subscription
2. Show pricing tiers clearly
3. Highlight Free tier features

**Label (optional caption):** "Choose the plan that fits your needs"

---

## 📱 How to Generate Screenshots

### Method 1: Using Expo/React Native (Recommended)

**Step 1: Run app on device/simulator**
```bash
# iOS Simulator
npx expo run:ios

# Android Emulator
npx expo run:android

# Or use Expo Go
npx expo start
```

**Step 2: Capture screenshots**

**iOS Simulator:**
```bash
# Command + S (captures to Desktop)
# Or: File → Save Screen
```

**Android Emulator:**
```bash
# Camera icon in emulator toolbar
# Or: Ctrl + S (Windows) / Cmd + S (Mac)
```

**Physical Device:**
- iPhone: Press Volume Up + Side Button
- Android: Press Volume Down + Power Button

---

### Method 2: Using Fastlane Snapshot (Automated)

**Install Fastlane:**
```bash
npm install -g fastlane
cd ios
fastlane snapshot init
```

**Configure snapshot:**
```ruby
# ios/fastlane/Snapfile
devices([
  "iPhone 15 Pro Max",    # 6.7" (2796×1290)
  "iPhone 15 Pro",        # 6.1" (2556×1179)
  "iPhone 14 Pro Max",    # 6.7"
  "iPad Pro (12.9-inch)"  # 12.9" (2048×2732)
])

languages(["en-US"])

scheme("OkapiFind")
```

**Run automated screenshots:**
```bash
fastlane snapshot
```

---

### Method 3: Using Screely (Quick Polish)

For adding professional backgrounds/frames (optional):
1. Take raw screenshots from app
2. Visit https://screely.com or https://screenshot.rocks
3. Upload screenshots
4. Add subtle gradient background (like current marketing ones)
5. Keep app interface 100% visible
6. Export at required dimensions

**⚠️ Important:** App interface must be REAL, only background can be styled

---

## 📐 Required Dimensions

### iOS App Store

| Device | Size (pixels) | Aspect Ratio |
|--------|---------------|--------------|
| iPhone 6.7" (15 Pro Max) | 1290×2796 | 19.5:9 |
| iPhone 6.5" (14 Pro Max) | 1284×2778 | 19.5:9 |
| iPhone 5.5" (8 Plus) | 1242×2208 | 16:9 |
| iPad Pro 12.9" | 2048×2732 | 4:3 |
| iPad Pro 11" | 1668×2388 | ~4:3 |

**Apple accepts:** PNG, JPEG
**File size:** Max 500KB per screenshot
**Number:** 3-10 screenshots per device size

---

### Google Play Store

| Device | Size (pixels) | Orientation |
|--------|---------------|-------------|
| Phone | 1080×1920 or higher | Portrait |
| 7" Tablet | 1200×1920 | Portrait |
| 10" Tablet | 1536×2048 | Portrait |

**Google accepts:** PNG, JPEG
**Requirements:**
- Minimum: 320px on short side
- Maximum: 3840px on long side
- Aspect ratio: 16:9 or 9:16
**Number:** 2-8 screenshots required

---

## 🎨 Screenshot Best Practices

### Do's ✅
- Show actual app interface
- Use real data (not "Lorem ipsum")
- Demonstrate core "Find My Car" feature first
- Show clean, uncluttered screens
- Use consistent location/demo data
- Add subtle captions (20-30 characters max)
- Show app in use (not empty states)
- Display Premium features (marked as "Pro")

### Don'ts ❌
- No device frames (Apple rejects this)
- No fake mockups or templates
- No "Download Now" CTAs in screenshots
- No competitor comparisons
- No user testimonials in screenshots
- No misleading features
- No text-heavy slides
- No placeholder graphics

---

## 🚀 Quick Start: Replace Current Screenshots

### Step 1: Delete Placeholder Screenshots
```bash
# Backup first (optional)
mv assets/app-store assets/app-store-OLD

# Create fresh directories
mkdir -p assets/app-store/ios/screenshots/iphone-6.5
mkdir -p assets/app-store/ios/screenshots/iphone-5.5
mkdir -p assets/app-store/ios/screenshots/ipad-12.9
mkdir -p assets/app-store/android/screenshots/phone
mkdir -p assets/app-store/android/screenshots/tablet-10
```

### Step 2: Run App and Capture
```bash
# Start app
npx expo start

# Open on iOS Simulator (6.5" iPhone)
# Press 'i' in Expo terminal

# Navigate through these screens and capture:
# 1. Main map with car saved
# 2. Navigation in progress
# 3. Photo note feature
# 4. Parking history
# 5. Settings/subscription

# Repeat for Android
```

### Step 3: Resize and Optimize
```bash
# Install ImageMagick (if not installed)
# macOS: brew install imagemagick
# Windows: Download from imagemagick.org

# Resize to exact dimensions
magick convert screenshot.png -resize 1284x2778 screenshot-final.png

# Optimize file size
magick convert screenshot-final.png -quality 85 screenshot-optimized.png
```

### Step 4: Rename According to Convention
```
ios/screenshots/iphone-6.5/
  01-main-map.png       (Map with car saved)
  02-navigation.png     (Turn-by-turn active)
  03-photo-note.png     (Photo attachment)
  04-history.png        (Past parking spots)
  05-subscription.png   (Pricing tiers)
```

---

## 📝 Screenshot Checklist

Before submission, verify each screenshot:

- [ ] Shows actual OkapiFind app interface
- [ ] No placeholder/mockup content
- [ ] Demonstrates real functionality
- [ ] Clear, readable text
- [ ] Proper dimensions for platform
- [ ] File size under 500KB (iOS) / 2MB (Android)
- [ ] Accurate representation (no fake features)
- [ ] Consistent branding/colors
- [ ] No sensitive user data visible
- [ ] No profanity or inappropriate content

---

## 🎬 Preview Video (Optional but Recommended)

### iOS App Preview (15-30 seconds)
**Capture screen recording:**
```bash
# iOS Simulator
# File → Record Screen → Start Recording
# Perform actions, then File → Stop Recording
```

**Requirements:**
- Format: .mov, .m4v, .mp4
- Duration: 15-30 seconds
- Size: Max 500MB
- Resolution: Match device (1242×2688 for 6.5")
- Show actual app usage

**Suggested flow:**
1. (0-5s) Open app, show empty map
2. (5-10s) Tap "Set Car Location", marker appears
3. (10-15s) Walk away, map updates
4. (15-20s) Tap "FIND MY CAR", navigation starts
5. (20-25s) Follow turn-by-turn to car
6. (25-30s) Arrive at car, success animation

---

### Android Promo Video (30 seconds max)
**Upload to YouTube:**
- Create unlisted YouTube video
- Paste link in Play Console
- Same suggested flow as iOS

---

## 🔧 Tools and Resources

### Screenshot Tools
- **iOS:** Simulator (built-in)
- **Android:** Android Studio emulator
- **Cross-platform:** Expo Screenshot Tool
- **Automation:** Fastlane Snapshot
- **Polish:** Screely, Screenshot.rocks

### Image Editing
- **Resize:** ImageMagick, Photoshop
- **Optimize:** TinyPNG, ImageOptim
- **Captions:** Canva, Figma

### Testing
- **Preview:** App Store Connect (before submission)
- **Play Console:** Draft listing preview

---

## 💡 Pro Tips

1. **Use realistic demo data:** Show actual streets/locations
2. **Consistent location:** Use same parking lot for all screenshots
3. **Time of day:** Take screenshots in daylight (better visibility)
4. **Clean UI:** Hide debug tools, status bars (if possible)
5. **Localization:** Take screenshots for each language (if localized)
6. **A/B Test:** Create multiple versions, see which converts better

---

## ✅ Next Steps

1. **Run the app** on simulator/device
2. **Capture 5 screenshots** per device size
3. **Replace placeholders** in `assets/app-store/`
4. **Verify dimensions** match requirements
5. **Optimize file sizes** for faster uploads
6. **Upload to App Store Connect** and Play Console
7. **Get feedback** from team before final submission

---

## 📞 Need Help?

**Issue:** Can't capture screenshots
**Solution:** Run `npx expo start` and ensure app builds successfully

**Issue:** Wrong dimensions
**Solution:** Use ImageMagick to resize: `magick convert input.png -resize 1284x2778 output.png`

**Issue:** File too large
**Solution:** Compress: `magick convert input.png -quality 85 output.png`

---

**Last Updated:** 2025-09-29
**Status:** ⚠️ Action required - Replace placeholder screenshots
**Deadline:** Before app submission