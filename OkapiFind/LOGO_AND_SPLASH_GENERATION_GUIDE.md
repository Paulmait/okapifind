# Logo & Splash Screen Generation Guide

## 📋 Current Status

**Assets in `assets/` folder:**
- ❌ `icon.png` - Generic placeholder (needs replacement)
- ❌ `splash-icon.png` - Generic placeholder (needs replacement)
- ❌ `adaptive-icon.png` - Generic placeholder (needs replacement)
- ❌ `favicon.png` - Generic placeholder (needs replacement)

**⚠️ CRITICAL: Replace these before App Store submission!**

---

## 🎨 OkapiFind Logo Design Requirements

### Brand Identity
**App Name:** OkapiFind
**Tagline:** "Find My Car"
**Brand Color:** `#4A90E2` (blue)
**Style:** Clean, modern, minimal

### Logo Concept
The logo should represent:
1. **Finding/Location** - GPS pin, map marker, radar
2. **Car** - Simple car silhouette
3. **Okapi** (optional) - Unique animal reference for brand recognition

### Recommended Logo Elements
```
Option 1: Map Pin + Car
┌─────────┐
│    📍    │  Map pin with car icon inside
│   🚗    │  Simple and recognizable
└─────────┘

Option 2: Radar/Target + Car
┌─────────┐
│  ◎ 🚗   │  Concentric circles with car
│         │  Represents location tracking
└─────────┘

Option 3: Location Wave + Car
┌─────────┐
│  ))) 🚗 │  Location signal waves
│         │  Modern tech aesthetic
└─────────┘
```

---

## 🛠️ Method 1: Generate Using Node.js Tools (Recommended)

### Step 1: Create Master Logo File

**Option A: Use Figma (Free)**
1. Go to https://figma.com (create free account)
2. Create new file
3. Design 1024×1024 icon:
   - Blue background: `#4A90E2`
   - White car icon or map pin
   - Export as PNG (1024×1024)

**Option B: Use Canva (Free)**
1. Go to https://canva.com
2. Search "App Icon" template
3. Customize with:
   - Brand color #4A90E2
   - Car + location pin icon
   - Export as PNG (1024×1024)

**Option C: Use AI Generator**
```bash
# Use DALL-E, Midjourney, or similar
Prompt: "Minimal app icon for car finder app, blue background #4A90E2,
white car silhouette with GPS pin, flat design, iOS app icon style,
1024x1024, no text"
```

### Step 2: Save Master Icon
```bash
# Save as 1024×1024 PNG with transparency (if needed)
OkapiFind/assets/icon-master.png
```

---

### Step 3: Generate All Sizes Using @expo/image-utils

**Install dependencies:**
```bash
cd OkapiFind
npm install --save-dev @expo/image-utils sharp
```

**Create generation script:**

**File:** `scripts/generate-icons.js`
```javascript
const { generateImageAsync } = require('@expo/image-utils');
const fs = require('fs');
const path = require('path');

const MASTER_ICON = path.join(__dirname, '..', 'assets', 'icon-master.png');
const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'app-store');

// iOS App Store icon sizes
const iosIcons = [
  { size: 1024, name: 'Icon-1024.png', folder: 'ios/icons' },
  { size: 180, name: 'Icon-60@3x.png', folder: 'ios/icons' },
  { size: 120, name: 'Icon-60@2x.png', folder: 'ios/icons' },
  { size: 120, name: 'Icon-40@3x.png', folder: 'ios/icons' },
  { size: 80, name: 'Icon-40@2x.png', folder: 'ios/icons' },
  { size: 87, name: 'Icon-29@3x.png', folder: 'ios/icons' },
  { size: 58, name: 'Icon-29@2x.png', folder: 'ios/icons' },
  { size: 60, name: 'Icon-20@3x.png', folder: 'ios/icons' },
  { size: 40, name: 'Icon-20@2x.png', folder: 'ios/icons' },
  { size: 152, name: 'Icon-76@2x.png', folder: 'ios/icons' },
  { size: 76, name: 'Icon-76.png', folder: 'ios/icons' },
  { size: 167, name: 'Icon-83.5@2x.png', folder: 'ios/icons' },
];

// Android icon sizes
const androidIcons = [
  { size: 512, name: 'playstore-icon.png', folder: 'android/icons' },
  { size: 192, name: 'ic_launcher.png', folder: 'android/icons/mipmap-xxxhdpi' },
  { size: 144, name: 'ic_launcher.png', folder: 'android/icons/mipmap-xxhdpi' },
  { size: 96, name: 'ic_launcher.png', folder: 'android/icons/mipmap-xhdpi' },
  { size: 72, name: 'ic_launcher.png', folder: 'android/icons/mipmap-hdpi' },
  { size: 48, name: 'ic_launcher.png', folder: 'android/icons/mipmap-mdpi' },
];

async function generateIcon(size, outputPath) {
  try {
    await generateImageAsync(
      { projectRoot: path.join(__dirname, '..') },
      {
        src: MASTER_ICON,
        width: size,
        height: size,
        resizeMode: 'contain',
        backgroundColor: 'transparent',
      },
      outputPath
    );
    console.log(`✅ Generated: ${outputPath}`);
  } catch (error) {
    console.error(`❌ Failed to generate ${outputPath}:`, error.message);
  }
}

async function main() {
  console.log('🎨 Generating OkapiFind icons...\n');

  // Create directories
  const allIcons = [...iosIcons, ...androidIcons];
  const uniqueFolders = [...new Set(allIcons.map(icon => path.join(OUTPUT_DIR, icon.folder)))];

  uniqueFolders.forEach(folder => {
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
  });

  // Generate iOS icons
  console.log('📱 Generating iOS icons...');
  for (const icon of iosIcons) {
    const outputPath = path.join(OUTPUT_DIR, icon.folder, icon.name);
    await generateIcon(icon.size, outputPath);
  }

  // Generate Android icons
  console.log('\n🤖 Generating Android icons...');
  for (const icon of androidIcons) {
    const outputPath = path.join(OUTPUT_DIR, icon.folder, icon.name);
    await generateIcon(icon.size, outputPath);
  }

  // Copy to root assets
  console.log('\n📦 Copying to root assets...');
  fs.copyFileSync(
    MASTER_ICON,
    path.join(__dirname, '..', 'assets', 'icon.png')
  );
  fs.copyFileSync(
    MASTER_ICON,
    path.join(__dirname, '..', 'assets', 'adaptive-icon.png')
  );
  fs.copyFileSync(
    path.join(OUTPUT_DIR, 'android/icons/playstore-icon.png'),
    path.join(__dirname, '..', 'assets', 'favicon.png')
  );

  console.log('\n✅ All icons generated successfully!');
}

main().catch(console.error);
```

**Run the script:**
```bash
node scripts/generate-icons.js
```

---

## 🌅 Splash Screen Generation

### Design Requirements

**iOS Splash:**
- Size: Varies by device (handled by Expo)
- Shows: App icon + brand color background
- Duration: 1-2 seconds
- No text (Apple guideline)

**Android Splash:**
- Size: Varies by device (handled by Expo)
- Shows: App icon + brand color background
- Duration: 1-2 seconds

### Step 1: Create Splash Icon

**Create:** `assets/splash-icon-master.png` (1284×1284)

```
Design:
┌──────────────────┐
│                  │
│                  │
│    🚗 📍        │  Car + Pin icon
│                  │  Centered
│   OkapiFind      │  Optional text below
│                  │
│                  │
└──────────────────┘

Background: #4A90E2 (brand blue)
Icon: White or transparent
Size: 1284×1284 (for iOS)
```

**Option: Use Figma/Canva**
1. Create 1284×1284 canvas
2. Blue background (#4A90E2)
3. Center icon (512×512 safe area)
4. Add "OkapiFind" text below (optional, 40pt font)
5. Export as PNG

---

### Step 2: Configure in app.json

Already configured! Check your `app.json`:

```json
{
  "expo": {
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    }
  }
}
```

**Update if needed:**
```json
{
  "expo": {
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#4A90E2"  // Brand color
    }
  }
}
```

---

### Step 3: Generate Splash Screens

Expo automatically generates splash screens for all devices! Just ensure `assets/splash-icon.png` exists.

**Manual generation (if needed):**

**File:** `scripts/generate-splash.js`
```javascript
const { generateImageAsync } = require('@expo/image-utils');
const path = require('path');

const SPLASH_MASTER = path.join(__dirname, '..', 'assets', 'splash-icon-master.png');

const splashSizes = [
  { width: 1242, height: 2688, name: 'splash-iphone-6.5.png' },    // iPhone 14 Pro Max
  { width: 1125, height: 2436, name: 'splash-iphone-5.8.png' },    // iPhone X
  { width: 2048, height: 2732, name: 'splash-ipad-12.9.png' },     // iPad Pro
  { width: 1080, height: 1920, name: 'splash-android-phone.png' }, // Android
];

async function generateSplash(width, height, outputPath) {
  await generateImageAsync(
    { projectRoot: path.join(__dirname, '..') },
    {
      src: SPLASH_MASTER,
      width,
      height,
      resizeMode: 'contain',
      backgroundColor: '#4A90E2',
    },
    outputPath
  );
  console.log(`✅ Generated: ${outputPath}`);
}

async function main() {
  console.log('🌅 Generating splash screens...\n');

  for (const splash of splashSizes) {
    const outputPath = path.join(__dirname, '..', 'assets', 'app-store', splash.name);
    await generateSplash(splash.width, splash.height, outputPath);
  }

  console.log('\n✅ All splash screens generated!');
}

main().catch(console.error);
```

**Run:**
```bash
node scripts/generate-splash.js
```

---

## 🎨 Quick Start: Free Logo Creation

### Option 1: Use Icon Maker (Online, Free)

**1. Go to:** https://icon.kitchen

**2. Configure:**
- Upload your simple car+pin sketch
- Or use built-in icons
- Set background: #4A90E2
- Download all sizes

**3. Extract:**
```bash
# Downloaded zip contains all iOS/Android sizes
unzip icon-kitchen-okapifind.zip -d assets/app-store/
```

---

### Option 2: Use Expo's Built-in Generator

**If you have a 1024×1024 icon:**

```bash
# Install
npm install -g @expo/icon-builder

# Generate all sizes
npx @expo/icon-builder assets/icon-master.png
```

This automatically generates:
- iOS icons (all sizes)
- Android icons (all densities)
- Adaptive icons

---

## 📐 Icon Specifications

### iOS Requirements
| Size | Purpose | Filename |
|------|---------|----------|
| 1024×1024 | App Store | Icon-1024.png |
| 180×180 | iPhone App (3x) | Icon-60@3x.png |
| 120×120 | iPhone App (2x) | Icon-60@2x.png |
| 152×152 | iPad App (2x) | Icon-76@2x.png |
| 76×76 | iPad App (1x) | Icon-76.png |

**Apple Guidelines:**
- No transparency (opaque background)
- No rounded corners (iOS adds automatically)
- RGB color space
- PNG format
- 72 DPI

---

### Android Requirements
| Density | Size | Purpose |
|---------|------|---------|
| xxxhdpi | 192×192 | High-end phones |
| xxhdpi | 144×144 | Standard phones |
| xhdpi | 96×96 | Older phones |
| hdpi | 72×72 | Low-end phones |
| mdpi | 48×48 | Very old phones |
| Play Store | 512×512 | Store listing |

**Google Guidelines:**
- Transparency allowed (adaptive icons)
- No rounded corners (Android adds)
- RGB or RGBA
- PNG format
- 72 DPI

---

## ✅ Pre-Submission Checklist

### Logo/Icon
- [ ] 1024×1024 master icon created
- [ ] Brand color #4A90E2 used
- [ ] Car/location finder concept visible
- [ ] All iOS sizes generated (12 files)
- [ ] All Android sizes generated (6 densities)
- [ ] No transparency on iOS icons
- [ ] Looks good at small sizes (48×48)
- [ ] Tested on light and dark backgrounds
- [ ] No text in icon (App Store guideline)
- [ ] Recognizable and unique

### Splash Screen
- [ ] 1284×1284 splash icon created
- [ ] Brand color background (#4A90E2)
- [ ] Icon centered with safe area
- [ ] app.json configured correctly
- [ ] Tested on iOS simulator
- [ ] Tested on Android emulator
- [ ] Loads in under 2 seconds
- [ ] No "Launch Screen" text (violation)

---

## 🚀 Quick Commands

**Generate everything at once:**

```bash
# 1. Create scripts directory
mkdir -p scripts

# 2. Copy generation scripts (from this guide)
# - scripts/generate-icons.js
# - scripts/generate-splash.js

# 3. Install dependencies
npm install --save-dev @expo/image-utils sharp

# 4. Create master icon (1024×1024)
# Save to: assets/icon-master.png

# 5. Create splash icon (1284×1284)
# Save to: assets/splash-icon-master.png

# 6. Run generators
node scripts/generate-icons.js
node scripts/generate-splash.js

# 7. Verify
ls -la assets/app-store/ios/icons/
ls -la assets/app-store/android/icons/
```

---

## 🎨 Design Inspiration

### Similar Apps (Reference Only)
- **Find My (Apple):** Green circle with white dot
- **Google Maps:** Multicolor pin
- **Waze:** Blue/white friendly icon
- **Parkopedia:** Orange parking "P"

### OkapiFind Unique Style
- **Color:** Blue (#4A90E2) - Trust, navigation
- **Icon:** Car + GPS pin - Direct functionality
- **Style:** Minimal, flat, modern
- **Memorability:** Unique, not generic

---

## 📞 Help & Resources

**Free Design Tools:**
- Figma: https://figma.com
- Canva: https://canva.com
- Icon Kitchen: https://icon.kitchen

**Icon Libraries (Free):**
- Material Icons: https://fonts.google.com/icons
- Font Awesome: https://fontawesome.com
- Heroicons: https://heroicons.com

**AI Generators:**
- DALL-E 3: https://openai.com/dall-e-3
- Midjourney: https://midjourney.com
- Stable Diffusion: https://stability.ai

**Validation:**
- iOS Icon Validator: https://appicon.co
- Android Asset Studio: https://romannurik.github.io/AndroidAssetStudio

---

## 💡 Pro Tips

1. **Keep it simple:** Icon should be recognizable at 48×48
2. **Test on device:** View on actual phone, not just computer
3. **Check contrast:** Readable on light/dark backgrounds
4. **Brand consistency:** Use same blue (#4A90E2) everywhere
5. **A/B test:** Show to 5-10 people, get feedback
6. **Competitor analysis:** Don't copy, but learn from successful apps
7. **Future-proof:** Design that works for next 3-5 years

---

**Next Steps:**
1. Create master icon (1024×1024)
2. Run generation scripts
3. Test on simulator/device
4. Get team feedback
5. Replace placeholders
6. Ready for submission!

---

**Last Updated:** 2025-09-29
**Status:** 🎨 Ready to generate
**Tools Required:** Node.js, Figma/Canva (for design)