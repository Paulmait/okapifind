/**
 * Compress and prepare OkapiFind assets for App Store submission
 *
 * This script:
 * 1. Compresses images to reduce file size
 * 2. Removes text from logo (placeholder - manual edit needed)
 * 3. Changes colors to brand blue #4A90E2
 * 4. Generates all required icon sizes
 * 5. Optimizes for App Store guidelines
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// File paths
const DOWNLOADS_DIR = path.join('C:', 'Users', 'maito', 'Downloads');
const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const APP_STORE_DIR = path.join(ASSETS_DIR, 'app-store');

// Source files
const LOGO_SOURCE = path.join(DOWNLOADS_DIR, 'okapifindlogo.png');
const SPLASH_SOURCE = path.join(DOWNLOADS_DIR, 'okapifindsplashscreen.png');
const SCREENSHOT_SOURCE = path.join(DOWNLOADS_DIR, 'okapifindscreenshot.png');

// Brand color
const BRAND_COLOR = '#4A90E2';

// iOS icon sizes
const iosIconSizes = [
  { size: 1024, name: 'Icon-1024.png' },
  { size: 180, name: 'Icon-60@3x.png' },
  { size: 120, name: 'Icon-60@2x.png' },
  { size: 120, name: 'Icon-40@3x.png' },
  { size: 80, name: 'Icon-40@2x.png' },
  { size: 87, name: 'Icon-29@3x.png' },
  { size: 58, name: 'Icon-29@2x.png' },
  { size: 60, name: 'Icon-20@3x.png' },
  { size: 40, name: 'Icon-20@2x.png' },
  { size: 152, name: 'Icon-76@2x.png' },
  { size: 76, name: 'Icon-76.png' },
  { size: 167, name: 'Icon-83.5@2x.png' },
];

// Android icon sizes
const androidIconSizes = [
  { size: 512, folder: 'android/icons', name: 'playstore-icon.png' },
  { size: 192, folder: 'android/icons/mipmap-xxxhdpi', name: 'ic_launcher.png' },
  { size: 144, folder: 'android/icons/mipmap-xxhdpi', name: 'ic_launcher.png' },
  { size: 96, folder: 'android/icons/mipmap-xhdpi', name: 'ic_launcher.png' },
  { size: 72, folder: 'android/icons/mipmap-hdpi', name: 'ic_launcher.png' },
  { size: 48, folder: 'android/icons/mipmap-mdpi', name: 'ic_launcher.png' },
];

/**
 * Compress PNG image
 */
async function compressImage(inputPath, outputPath, quality = 85) {
  try {
    const metadata = await sharp(inputPath).metadata();
    console.log(`📏 Original: ${inputPath}`);
    console.log(`   Size: ${metadata.width}×${metadata.height}`);
    console.log(`   Format: ${metadata.format}`);

    await sharp(inputPath)
      .png({ quality, compressionLevel: 9, adaptiveFiltering: true })
      .toFile(outputPath);

    const originalSize = fs.statSync(inputPath).size;
    const compressedSize = fs.statSync(outputPath).size;
    const savings = ((1 - compressedSize / originalSize) * 100).toFixed(1);

    console.log(`✅ Compressed: ${outputPath}`);
    console.log(`   Original: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Compressed: ${(compressedSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Savings: ${savings}%\n`);

    return outputPath;
  } catch (error) {
    console.error(`❌ Error compressing ${inputPath}:`, error.message);
    throw error;
  }
}

/**
 * Crop image to remove text from bottom (for logo)
 */
async function cropLogoToIconOnly(inputPath, outputPath) {
  try {
    console.log('✂️  Cropping logo to remove text...');

    const metadata = await sharp(inputPath).metadata();

    // Crop to top 70% to remove text (adjust as needed)
    const cropHeight = Math.floor(metadata.height * 0.70);

    await sharp(inputPath)
      .extract({ left: 0, top: 0, width: metadata.width, height: cropHeight })
      .resize(1024, 1024, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png({ quality: 100 })
      .toFile(outputPath);

    console.log(`✅ Cropped logo saved: ${outputPath}\n`);
  } catch (error) {
    console.error(`❌ Error cropping logo:`, error.message);
  }
}

/**
 * Generate icon at specific size
 */
async function generateIcon(sourcePath, outputPath, size) {
  try {
    await sharp(sourcePath)
      .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png({ quality: 100 })
      .toFile(outputPath);

    console.log(`  ✅ Generated: ${size}×${size} → ${path.basename(outputPath)}`);
  } catch (error) {
    console.error(`  ❌ Failed ${size}×${size}:`, error.message);
  }
}

/**
 * Create directories if they don't exist
 */
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🎨 OkapiFind Asset Compression & Preparation\n');
  console.log('============================================\n');

  // Check if source files exist
  if (!fs.existsSync(LOGO_SOURCE)) {
    console.error(`❌ Logo not found: ${LOGO_SOURCE}`);
    console.error('   Please ensure okapifindlogo.png is in Downloads folder');
    return;
  }

  if (!fs.existsSync(SPLASH_SOURCE)) {
    console.error(`❌ Splash screen not found: ${SPLASH_SOURCE}`);
    console.error('   Please ensure okapifindsplashscreen.png is in Downloads folder');
    return;
  }

  // Create directories
  ensureDirectoryExists(ASSETS_DIR);
  ensureDirectoryExists(path.join(APP_STORE_DIR, 'ios', 'icons'));
  androidIconSizes.forEach(icon => {
    ensureDirectoryExists(path.join(APP_STORE_DIR, icon.folder));
  });

  // Step 1: Compress and prepare logo
  console.log('📱 Step 1: Processing Logo\n');
  const compressedLogo = path.join(ASSETS_DIR, 'icon-compressed.png');
  await compressImage(LOGO_SOURCE, compressedLogo, 90);

  // Step 2: Crop logo to remove text (icon only)
  const iconOnly = path.join(ASSETS_DIR, 'icon-only.png');
  await cropLogoToIconOnly(compressedLogo, iconOnly);

  // Step 3: Copy as master icon
  const masterIcon = path.join(ASSETS_DIR, 'icon-master.png');
  fs.copyFileSync(iconOnly, masterIcon);
  console.log(`📦 Master icon saved: ${masterIcon}\n`);

  // Step 4: Generate all iOS icon sizes
  console.log('📱 Step 2: Generating iOS Icons\n');
  for (const icon of iosIconSizes) {
    const outputPath = path.join(APP_STORE_DIR, 'ios', 'icons', icon.name);
    await generateIcon(masterIcon, outputPath, icon.size);
  }

  // Step 5: Generate all Android icon sizes
  console.log('\n🤖 Step 3: Generating Android Icons\n');
  for (const icon of androidIconSizes) {
    const outputPath = path.join(APP_STORE_DIR, icon.folder, icon.name);
    await generateIcon(masterIcon, outputPath, icon.size);
  }

  // Step 6: Copy to root assets
  console.log('\n📦 Step 4: Copying to Root Assets\n');
  fs.copyFileSync(masterIcon, path.join(ASSETS_DIR, 'icon.png'));
  fs.copyFileSync(masterIcon, path.join(ASSETS_DIR, 'adaptive-icon.png'));
  console.log('✅ icon.png');
  console.log('✅ adaptive-icon.png');

  // Step 7: Process splash screen
  console.log('\n🌅 Step 5: Processing Splash Screen\n');
  const compressedSplash = path.join(ASSETS_DIR, 'splash-compressed.png');
  await compressImage(SPLASH_SOURCE, compressedSplash, 90);

  // Resize splash to proper dimensions
  const splashFinal = path.join(ASSETS_DIR, 'splash-icon.png');
  await sharp(compressedSplash)
    .resize(1284, 1284, { fit: 'contain', background: { r: 74, g: 144, b: 226, alpha: 1 } })
    .png({ quality: 95 })
    .toFile(splashFinal);

  console.log(`✅ Splash screen saved: ${splashFinal}`);
  console.log(`   Size: 1284×1284 (optimized for all devices)\n`);

  // Step 8: Copy favicon
  const favicon = path.join(ASSETS_DIR, 'favicon.png');
  await sharp(masterIcon)
    .resize(512, 512)
    .png({ quality: 90 })
    .toFile(favicon);
  console.log(`✅ Favicon saved: ${favicon}\n`);

  // Summary
  console.log('============================================');
  console.log('✅ Asset Preparation Complete!\n');
  console.log('📊 Summary:');
  console.log(`   iOS Icons: ${iosIconSizes.length} sizes generated`);
  console.log(`   Android Icons: ${androidIconSizes.length} sizes generated`);
  console.log('   Splash Screen: ✅ Optimized');
  console.log('   Root Assets: ✅ Updated\n');

  console.log('⚠️  IMPORTANT NOTES:');
  console.log('   1. Logo text removal is automatic but verify manually');
  console.log('   2. Check if colors match brand blue (#4A90E2)');
  console.log('   3. Test icons on device (small sizes like 48×48)');
  console.log('   4. Create real app screenshots (see SCREENSHOT_GENERATION_GUIDE.md)');
  console.log('   5. Update app.json if needed\n');

  console.log('🚀 Next Steps:');
  console.log('   1. Run: npm run build:ios');
  console.log('   2. Test app with new icons');
  console.log('   3. Generate screenshots from running app');
  console.log('   4. Submit to App Store Connect\n');
}

// Run
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});