/**
 * iPad Screenshot Generator for App Store
 * Generates proper iPad screenshots from iPhone screenshots
 *
 * Apple requires iPad screenshots to show the app as it appears on iPad,
 * NOT iPhone mockups on a colored background.
 *
 * Usage: node scripts/generate-ipad-screenshots.js
 * Required: npm install sharp
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// iPad screenshot size specifications (Apple requirements 2024/2025)
const IPAD_SIZES = {
  'ipad-13': {
    width: 2048,
    height: 2732,
    name: 'iPad Pro 12.9" / iPad Air 13"',
    folder: 'ipad-13'
  },
  'ipad-11': {
    width: 1668,
    height: 2388,
    name: 'iPad Pro 11" / iPad Air 11"',
    folder: 'ipad-11'
  },
};

// Source: Use 6.5" iPhone screenshots as base (they're full-screen app captures)
const SOURCE_DIR = path.join(__dirname, '../assets/app-store/ios/screenshots/6.5-inch');
const OUTPUT_BASE = path.join(__dirname, '../assets/app-store/ios/screenshots');

// Screenshot mapping (source filename -> output filename)
const SCREENSHOT_MAP = [
  { src: '01-home-map.png', out: '01-home-map.png' },
  { src: '02-floor-selector.png', out: '02-floor-selector.png' },
  { src: '03-location-saved.png', out: '03-location-saved.png' },
  { src: '04-settings-features.png', out: '04-settings-features.png' },
  { src: '05-premium-paywall.png', out: '05-premium-paywall.png' },
  { src: '06-settings-legal.png', out: '06-settings-legal.png' },
];

async function generateIPadScreenshots() {
  console.log('📱 iPad Screenshot Generator for App Store\n');
  console.log('This generates full-screen iPad screenshots from iPhone app captures.\n');

  // Check if source directory exists
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error('❌ Source directory not found:', SOURCE_DIR);
    console.log('Please ensure you have screenshots in the 6.5-inch folder first.');
    process.exit(1);
  }

  // Get list of available source screenshots
  const availableFiles = fs.readdirSync(SOURCE_DIR).filter(f => f.endsWith('.png'));
  console.log(`Found ${availableFiles.length} source screenshots in 6.5-inch folder\n`);

  for (const [sizeKey, size] of Object.entries(IPAD_SIZES)) {
    const outputDir = path.join(OUTPUT_BASE, size.folder);

    // Create output directory (backup existing files first)
    if (fs.existsSync(outputDir)) {
      const backupDir = path.join(OUTPUT_BASE, `${size.folder}-backup-${Date.now()}`);
      console.log(`📁 Backing up existing ${size.folder} to ${path.basename(backupDir)}`);
      fs.renameSync(outputDir, backupDir);
    }
    fs.mkdirSync(outputDir, { recursive: true });

    console.log(`\n📐 Generating ${size.name} (${size.width}x${size.height})...`);

    for (const mapping of SCREENSHOT_MAP) {
      const inputPath = path.join(SOURCE_DIR, mapping.src);
      const outputPath = path.join(outputDir, mapping.out);

      if (!fs.existsSync(inputPath)) {
        console.log(`  ⚠️  Skipping ${mapping.src} (not found)`);
        continue;
      }

      try {
        // Get source image metadata
        const metadata = await sharp(inputPath).metadata();
        const srcAspect = metadata.width / metadata.height;
        const dstAspect = size.width / size.height;

        // For iPad, we want to show the app full-screen
        // Scale the iPhone screenshot to fill the iPad dimensions
        // This creates a full-screen iPad app appearance

        await sharp(inputPath)
          .resize(size.width, size.height, {
            fit: 'cover',      // Fill the entire iPad canvas
            position: 'north', // Align to top (keeps status bar/nav visible)
          })
          .png({ quality: 100, compressionLevel: 9 })
          .toFile(outputPath);

        console.log(`  ✅ ${mapping.out}`);
      } catch (err) {
        console.error(`  ❌ ${mapping.src}: ${err.message}`);
      }
    }
  }

  console.log('\n\n✅ iPad screenshot generation complete!');
  console.log('\n📋 Generated iPad screenshots:');

  for (const [sizeKey, size] of Object.entries(IPAD_SIZES)) {
    const dir = path.join(OUTPUT_BASE, size.folder);
    if (fs.existsSync(dir)) {
      const count = fs.readdirSync(dir).filter(f => f.endsWith('.png')).length;
      console.log(`  ${size.folder}: ${count} screenshots (${size.width}x${size.height})`);
    }
  }

  console.log('\n📱 Apple App Store iPad Requirements:');
  console.log('  - iPad Pro 12.9" (2048x2732) - Required for iPad app listings');
  console.log('  - iPad Pro 11" (1668x2388) - Required for iPad app listings');
  console.log('\n⚠️  Important: Screenshots must show the app as it appears on iPad,');
  console.log('   not iPhone mockups on a colored background.');
  console.log('\n📤 Upload these to App Store Connect > App Store > Screenshots > iPad');
}

// Run the generator
generateIPadScreenshots().catch(console.error);
