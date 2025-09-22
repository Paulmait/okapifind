#!/usr/bin/env node

/**
 * App Icon and Store Assets Generator
 * Generates all required icons and screenshots for iOS and Android app stores
 * Follows Apple and Google guidelines for app store submission
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Icon sizes required for iOS App Store
const iOSIconSizes = [
  { size: 20, scale: 2, name: 'icon-20@2x.png' },
  { size: 20, scale: 3, name: 'icon-20@3x.png' },
  { size: 29, scale: 2, name: 'icon-29@2x.png' },
  { size: 29, scale: 3, name: 'icon-29@3x.png' },
  { size: 40, scale: 2, name: 'icon-40@2x.png' },
  { size: 40, scale: 3, name: 'icon-40@3x.png' },
  { size: 60, scale: 2, name: 'icon-60@2x.png' },
  { size: 60, scale: 3, name: 'icon-60@3x.png' },
  { size: 1024, scale: 1, name: 'icon-1024.png', noAlpha: true }, // App Store
];

// Icon sizes required for Android Play Store
const androidIconSizes = [
  { size: 48, name: 'mipmap-mdpi/ic_launcher.png' },
  { size: 72, name: 'mipmap-hdpi/ic_launcher.png' },
  { size: 96, name: 'mipmap-xhdpi/ic_launcher.png' },
  { size: 144, name: 'mipmap-xxhdpi/ic_launcher.png' },
  { size: 192, name: 'mipmap-xxxhdpi/ic_launcher.png' },
  { size: 512, name: 'playstore-icon.png' }, // Play Store
];

// Adaptive icon for Android
const androidAdaptiveIconSizes = [
  { size: 108, name: 'mipmap-mdpi/ic_launcher_foreground.png' },
  { size: 162, name: 'mipmap-hdpi/ic_launcher_foreground.png' },
  { size: 216, name: 'mipmap-xhdpi/ic_launcher_foreground.png' },
  { size: 324, name: 'mipmap-xxhdpi/ic_launcher_foreground.png' },
  { size: 432, name: 'mipmap-xxxhdpi/ic_launcher_foreground.png' },
];

// Screenshot sizes for app stores
const screenshotSizes = {
  ios: [
    { width: 1290, height: 2796, name: 'iphone-6.7.png', device: 'iPhone 15 Pro Max' },
    { width: 1179, height: 2556, name: 'iphone-6.5.png', device: 'iPhone 14 Pro Max' },
    { width: 1170, height: 2532, name: 'iphone-6.1.png', device: 'iPhone 14 Pro' },
    { width: 1125, height: 2436, name: 'iphone-5.8.png', device: 'iPhone X' },
    { width: 2048, height: 2732, name: 'ipad-12.9.png', device: 'iPad Pro 12.9' },
    { width: 1668, height: 2388, name: 'ipad-11.png', device: 'iPad Pro 11' },
  ],
  android: [
    { width: 1080, height: 1920, name: 'phone.png', device: 'Phone' },
    { width: 1600, height: 2560, name: 'tablet-7.png', device: '7" Tablet' },
    { width: 1920, height: 3840, name: 'tablet-10.png', device: '10" Tablet' },
  ],
};

// Feature graphic for Play Store
const featureGraphic = {
  width: 1024,
  height: 500,
  name: 'feature-graphic.png',
};

// Default app icon design (if source not provided)
const defaultIconSVG = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FFD700;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#FFA500;stop-opacity:1" />
    </linearGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="8" stdDeviation="16" flood-opacity="0.2"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1024" height="1024" fill="url(#bg)" rx="220"/>

  <!-- Car Icon -->
  <g transform="translate(512, 450)" filter="url(#shadow)">
    <rect x="-200" y="-80" width="400" height="160" rx="30" fill="white"/>
    <rect x="-180" y="-100" width="360" height="80" rx="40" fill="white"/>
    <circle cx="-100" cy="60" r="40" fill="#333"/>
    <circle cx="100" cy="60" r="40" fill="#333"/>
    <rect x="-120" y="-80" width="80" height="60" fill="#4A90E2" opacity="0.7"/>
    <rect x="40" y="-80" width="80" height="60" fill="#4A90E2" opacity="0.7"/>
  </g>

  <!-- Location Pin -->
  <g transform="translate(512, 300)">
    <path d="M 0,-100 C -55,-100 -100,-55 -100,0 C -100,35 -60,120 0,180 C 60,120 100,35 100,0 C 100,-55 55,-100 0,-100 Z"
          fill="#FF4444" stroke="white" stroke-width="16"/>
    <circle cx="0" cy="0" r="35" fill="white"/>
  </g>

  <!-- App Name -->
  <text x="512" y="750" font-family="Arial, sans-serif" font-size="120" font-weight="bold"
        text-anchor="middle" fill="white">OkapiFind</text>
</svg>
`;

class AppAssetGenerator {
  constructor() {
    this.outputDir = path.join(process.cwd(), 'app-assets');
    this.sourcePath = null;
  }

  async initialize() {
    // Create output directories
    const dirs = [
      this.outputDir,
      path.join(this.outputDir, 'ios'),
      path.join(this.outputDir, 'android'),
      path.join(this.outputDir, 'android', 'mipmap-mdpi'),
      path.join(this.outputDir, 'android', 'mipmap-hdpi'),
      path.join(this.outputDir, 'android', 'mipmap-xhdpi'),
      path.join(this.outputDir, 'android', 'mipmap-xxhdpi'),
      path.join(this.outputDir, 'android', 'mipmap-xxxhdpi'),
      path.join(this.outputDir, 'screenshots', 'ios'),
      path.join(this.outputDir, 'screenshots', 'android'),
      path.join(this.outputDir, 'marketing'),
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    console.log('✅ Created output directories');
  }

  async generateDefaultIcon() {
    const iconPath = path.join(this.outputDir, 'source-icon.png');

    await sharp(Buffer.from(defaultIconSVG))
      .png()
      .toFile(iconPath);

    this.sourcePath = iconPath;
    console.log('✅ Generated default icon design');
    return iconPath;
  }

  async generateIcons() {
    console.log('🎨 Generating app icons...');

    // Generate iOS icons
    for (const config of iOSIconSizes) {
      const size = config.size * config.scale;
      const outputPath = path.join(this.outputDir, 'ios', config.name);

      const image = sharp(this.sourcePath)
        .resize(size, size, {
          fit: 'cover',
          position: 'center'
        });

      // Remove alpha channel for App Store icon
      if (config.noAlpha) {
        await image
          .flatten({ background: '#ffffff' })
          .toFile(outputPath);
      } else {
        await image.toFile(outputPath);
      }

      console.log(`  ✓ iOS ${config.name} (${size}x${size})`);
    }

    // Generate Android icons
    for (const config of androidIconSizes) {
      const outputPath = path.join(this.outputDir, 'android', config.name);

      await sharp(this.sourcePath)
        .resize(config.size, config.size, {
          fit: 'cover',
          position: 'center'
        })
        .toFile(outputPath);

      console.log(`  ✓ Android ${config.name} (${config.size}x${config.size})`);
    }

    // Generate Android adaptive icons
    for (const config of androidAdaptiveIconSizes) {
      const outputPath = path.join(this.outputDir, 'android', config.name);

      // Add padding for adaptive icon safe zone
      const padding = Math.round(config.size * 0.25);

      await sharp(this.sourcePath)
        .resize(config.size - padding * 2, config.size - padding * 2, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .extend({
          top: padding,
          bottom: padding,
          left: padding,
          right: padding,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .toFile(outputPath);

      console.log(`  ✓ Android Adaptive ${config.name} (${config.size}x${config.size})`);
    }
  }

  async generateScreenshots() {
    console.log('📱 Generating screenshot templates...');

    // Create sample screenshot with app branding
    const screenshotSVG = (width, height, device, platform) => `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#FFD700;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#FFA500;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${width}" height="${height}" fill="url(#bg)"/>

  <!-- Device Frame -->
  <rect x="20" y="20" width="${width - 40}" height="${height - 40}" rx="40"
        fill="white" stroke="#333" stroke-width="4"/>

  <!-- Status Bar -->
  <rect x="20" y="20" width="${width - 40}" height="100" rx="40" fill="#f0f0f0"/>

  <!-- App Content -->
  <text x="${width / 2}" y="${height / 2 - 100}"
        font-family="Arial, sans-serif" font-size="72" font-weight="bold"
        text-anchor="middle" fill="#333">OkapiFind</text>

  <text x="${width / 2}" y="${height / 2}"
        font-family="Arial, sans-serif" font-size="48"
        text-anchor="middle" fill="#666">Never lose your car again</text>

  <text x="${width / 2}" y="${height / 2 + 100}"
        font-family="Arial, sans-serif" font-size="36"
        text-anchor="middle" fill="#999">${device}</text>

  <!-- Feature Icons -->
  <g transform="translate(${width / 2}, ${height / 2 + 200})">
    <text x="-150" y="0" font-size="60">📍</text>
    <text x="-50" y="0" font-size="60">🚗</text>
    <text x="50" y="0" font-size="60">🔔</text>
    <text x="150" y="0" font-size="60">📸</text>
  </g>

  <!-- Call to Action -->
  <rect x="${width / 2 - 200}" y="${height - 300}" width="400" height="100"
        rx="50" fill="#FF4444"/>
  <text x="${width / 2}" y="${height - 240}"
        font-family="Arial, sans-serif" font-size="36" font-weight="bold"
        text-anchor="middle" fill="white">Download Now</text>
</svg>
    `;

    // Generate iOS screenshots
    for (const config of screenshotSizes.ios) {
      const svg = screenshotSVG(config.width, config.height, config.device, 'ios');
      const outputPath = path.join(this.outputDir, 'screenshots', 'ios', config.name);

      await sharp(Buffer.from(svg))
        .png()
        .toFile(outputPath);

      console.log(`  ✓ iOS Screenshot ${config.name} (${config.device})`);
    }

    // Generate Android screenshots
    for (const config of screenshotSizes.android) {
      const svg = screenshotSVG(config.width, config.height, config.device, 'android');
      const outputPath = path.join(this.outputDir, 'screenshots', 'android', config.name);

      await sharp(Buffer.from(svg))
        .png()
        .toFile(outputPath);

      console.log(`  ✓ Android Screenshot ${config.name} (${config.device})`);
    }
  }

  async generateMarketingAssets() {
    console.log('🎯 Generating marketing assets...');

    // Feature graphic for Play Store
    const featureGraphicSVG = `
<svg width="${featureGraphic.width}" height="${featureGraphic.height}" viewBox="0 0 ${featureGraphic.width} ${featureGraphic.height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#FFD700;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#FFA500;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${featureGraphic.width}" height="${featureGraphic.height}" fill="url(#bg)"/>

  <!-- Logo and Text -->
  <text x="512" y="200" font-family="Arial, sans-serif" font-size="96" font-weight="bold"
        text-anchor="middle" fill="white">OkapiFind</text>

  <text x="512" y="280" font-family="Arial, sans-serif" font-size="36"
        text-anchor="middle" fill="white">Your Smart Parking Companion</text>

  <!-- Feature Icons -->
  <g transform="translate(512, 380)">
    <text x="-300" y="0" font-size="72">📍 Find</text>
    <text x="-100" y="0" font-size="72">🚗 Save</text>
    <text x="100" y="0" font-size="72">🔔 Remember</text>
    <text x="300" y="0" font-size="72">📸 Share</text>
  </g>
</svg>
    `;

    const outputPath = path.join(this.outputDir, 'marketing', featureGraphic.name);
    await sharp(Buffer.from(featureGraphicSVG))
      .png()
      .toFile(outputPath);

    console.log(`  ✓ Feature Graphic (${featureGraphic.width}x${featureGraphic.height})`);
  }

  async generateMetadata() {
    const metadata = {
      generated: new Date().toISOString(),
      icons: {
        ios: iOSIconSizes.map(s => ({
          file: s.name,
          size: s.size * s.scale,
        })),
        android: androidIconSizes.map(s => ({
          file: s.name,
          size: s.size,
        })),
      },
      screenshots: screenshotSizes,
      instructions: {
        ios: 'Copy ios/*.png files to your Xcode project Assets.xcassets',
        android: 'Copy android/mipmap-* directories to android/app/src/main/res/',
        expo: 'Update app.json with icon paths',
      },
    };

    fs.writeFileSync(
      path.join(this.outputDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    console.log('✅ Generated metadata.json');
  }

  async run() {
    console.log('🚀 OkapiFind App Asset Generator');
    console.log('================================\n');

    await this.initialize();

    // Check for source icon or generate default
    const sourceArg = process.argv[2];
    if (sourceArg && fs.existsSync(sourceArg)) {
      this.sourcePath = sourceArg;
      console.log(`✅ Using source icon: ${sourceArg}`);
    } else {
      await this.generateDefaultIcon();
    }

    await this.generateIcons();
    await this.generateScreenshots();
    await this.generateMarketingAssets();
    await this.generateMetadata();

    console.log('\n✨ All assets generated successfully!');
    console.log(`📁 Output directory: ${this.outputDir}`);
    console.log('\nNext steps:');
    console.log('1. Review generated assets in app-assets/ directory');
    console.log('2. Replace with actual screenshots from your app');
    console.log('3. Update app.json with icon paths');
    console.log('4. Copy icons to platform-specific directories');
  }
}

// Check if sharp is installed
try {
  require.resolve('sharp');
} catch (e) {
  console.error('❌ Error: sharp is not installed');
  console.log('Run: npm install sharp');
  process.exit(1);
}

// Run the generator
const generator = new AppAssetGenerator();
generator.run().catch(console.error);