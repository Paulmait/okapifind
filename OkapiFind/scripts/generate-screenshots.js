/**
 * Screenshot Generator for App Store
 * Generates missing iPhone 6.7" and 6.9" screenshots from existing 6.5" screenshots
 *
 * Usage: node scripts/generate-screenshots.js
 *
 * Required: npm install sharp
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Screenshot size specifications (Apple requirements 2024/2025)
const SCREENSHOT_SIZES = {
  'iphone-6.9': { width: 1320, height: 2868, name: 'iPhone 16 Pro Max' },
  'iphone-6.7': { width: 1290, height: 2796, name: 'iPhone 14/15 Pro Max' },
  'iphone-6.5': { width: 1284, height: 2778, name: 'iPhone 11/12/13 Pro Max' }, // Alternative: 1242 x 2688
};

// Source directory (using existing 6.5" screenshots as base)
const SOURCE_DIR = path.join(__dirname, '../assets/app-store/ios/screenshots/iphone-6.5');
const OUTPUT_BASE = path.join(__dirname, '../assets/app-store/ios/screenshots');

async function generateScreenshots() {
  console.log('📱 Screenshot Generator for App Store\n');

  // Check if source directory exists
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error('❌ Source directory not found:', SOURCE_DIR);
    console.log('Please ensure you have screenshots in the iphone-6.5 folder first.');
    process.exit(1);
  }

  // Get list of source screenshots
  const sourceFiles = fs.readdirSync(SOURCE_DIR).filter(f => f.endsWith('.png'));
  console.log(`Found ${sourceFiles.length} source screenshots\n`);

  // Sizes to generate
  const sizesToGenerate = ['iphone-6.7', 'iphone-6.9'];

  for (const sizeKey of sizesToGenerate) {
    const size = SCREENSHOT_SIZES[sizeKey];
    const outputDir = path.join(OUTPUT_BASE, sizeKey);

    // Create output directory
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`\n📐 Generating ${size.name} (${size.width}x${size.height})...`);

    for (const file of sourceFiles) {
      const inputPath = path.join(SOURCE_DIR, file);
      const outputPath = path.join(outputDir, file);

      try {
        await sharp(inputPath)
          .resize(size.width, size.height, {
            fit: 'cover',
            position: 'center',
          })
          .png({ quality: 100 })
          .toFile(outputPath);

        console.log(`  ✅ ${file}`);
      } catch (err) {
        console.error(`  ❌ ${file}: ${err.message}`);
      }
    }
  }

  // Generate landscape versions too
  console.log('\n\n🔄 Generating landscape versions...');

  for (const sizeKey of sizesToGenerate) {
    const size = SCREENSHOT_SIZES[sizeKey];
    const portraitDir = path.join(OUTPUT_BASE, sizeKey);
    const landscapeDir = path.join(OUTPUT_BASE, `${sizeKey}-landscape`);

    // Create landscape directory
    if (!fs.existsSync(landscapeDir)) {
      fs.mkdirSync(landscapeDir, { recursive: true });
    }

    const portraitFiles = fs.readdirSync(portraitDir).filter(f => f.endsWith('.png'));

    console.log(`\n📐 Generating ${size.name} Landscape (${size.height}x${size.width})...`);

    for (const file of portraitFiles) {
      const inputPath = path.join(portraitDir, file);
      const outputPath = path.join(landscapeDir, file.replace('.png', '-landscape.png'));

      try {
        await sharp(inputPath)
          .rotate(90)
          .resize(size.height, size.width, {
            fit: 'cover',
            position: 'center',
          })
          .png({ quality: 100 })
          .toFile(outputPath);

        console.log(`  ✅ ${file.replace('.png', '-landscape.png')}`);
      } catch (err) {
        console.error(`  ❌ ${file}: ${err.message}`);
      }
    }
  }

  console.log('\n\n✅ Screenshot generation complete!');
  console.log('\nGenerated screenshots:');

  for (const sizeKey of sizesToGenerate) {
    const size = SCREENSHOT_SIZES[sizeKey];
    const dir = path.join(OUTPUT_BASE, sizeKey);
    if (fs.existsSync(dir)) {
      const count = fs.readdirSync(dir).filter(f => f.endsWith('.png')).length;
      console.log(`  ${sizeKey}: ${count} screenshots (${size.width}x${size.height})`);
    }
  }

  console.log('\n📋 Apple App Store Requirements Summary:');
  console.log('  Required sizes for submission:');
  console.log('  - iPhone 6.9" (1320x2868) - iPhone 16 Pro Max');
  console.log('  - iPhone 6.7" (1290x2796) - iPhone 14/15 Pro Max');
  console.log('  - iPad Pro 12.9" (2048x2732) - Already have ✓');
}

// Run the generator
generateScreenshots().catch(console.error);
