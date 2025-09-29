/**
 * App Store Asset Generator
 * Generates all required images for Apple App Store and Google Play Store
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// App icon configuration
const APP_ICON_SIZES = {
  ios: [
    { size: 20, scale: [2, 3], name: 'Icon-20' },
    { size: 29, scale: [2, 3], name: 'Icon-29' },
    { size: 40, scale: [2, 3], name: 'Icon-40' },
    { size: 60, scale: [2, 3], name: 'Icon-60' },
    { size: 76, scale: [1, 2], name: 'Icon-76' },
    { size: 83.5, scale: [2], name: 'Icon-83.5' },
    { size: 1024, scale: [1], name: 'Icon-1024', noAlpha: true },
  ],
  android: [
    { size: 48, name: 'mipmap-mdpi/ic_launcher' },
    { size: 72, name: 'mipmap-hdpi/ic_launcher' },
    { size: 96, name: 'mipmap-xhdpi/ic_launcher' },
    { size: 144, name: 'mipmap-xxhdpi/ic_launcher' },
    { size: 192, name: 'mipmap-xxxhdpi/ic_launcher' },
    { size: 512, name: 'playstore-icon' },
  ],
  android_adaptive: [
    { size: 108, name: 'mipmap-mdpi/ic_launcher_foreground' },
    { size: 162, name: 'mipmap-hdpi/ic_launcher_foreground' },
    { size: 216, name: 'mipmap-xhdpi/ic_launcher_foreground' },
    { size: 324, name: 'mipmap-xxhdpi/ic_launcher_foreground' },
    { size: 432, name: 'mipmap-xxxhdpi/ic_launcher_foreground' },
  ],
};

// Screenshot sizes
const SCREENSHOT_SIZES = {
  ios: [
    { width: 1242, height: 2688, name: 'iPhone 12 Pro Max', folder: 'iphone-6.5' },
    { width: 1170, height: 2532, name: 'iPhone 12 Pro', folder: 'iphone-5.8' },
    { width: 1242, height: 2208, name: 'iPhone 8 Plus', folder: 'iphone-5.5' },
    { width: 2048, height: 2732, name: 'iPad Pro 12.9"', folder: 'ipad-12.9' },
    { width: 1668, height: 2388, name: 'iPad Pro 11"', folder: 'ipad-11' },
  ],
  android: [
    { width: 1080, height: 1920, name: 'Phone', folder: 'phone' },
    { width: 1600, height: 2560, name: 'Tablet 10"', folder: 'tablet-10' },
    { width: 1920, height: 3840, name: 'Tablet 7"', folder: 'tablet-7' },
  ],
};

// Feature graphic for Google Play
const FEATURE_GRAPHIC = { width: 1024, height: 500 };

// Promo graphic for Google Play
const PROMO_GRAPHIC = { width: 180, height: 120 };

// TV banner for Android TV
const TV_BANNER = { width: 1280, height: 720 };

// Colors and branding
const BRAND_COLORS = {
  primary: '#007AFF',
  secondary: '#5AC8FA',
  success: '#34C759',
  warning: '#FF9500',
  danger: '#FF3B30',
  dark: '#1C1C1E',
  light: '#F2F2F7',
  white: '#FFFFFF',
  gradient: ['#007AFF', '#5AC8FA'],
};

/**
 * Create base icon with rounded corners
 */
async function createBaseIcon(size) {
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${BRAND_COLORS.primary};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${BRAND_COLORS.secondary};stop-opacity:1" />
        </linearGradient>
        <filter id="shadow">
          <feDropShadow dx="0" dy="4" stdDeviation="4" flood-opacity="0.25"/>
        </filter>
      </defs>

      <!-- Background -->
      <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="url(#grad)"/>

      <!-- Car Icon -->
      <g transform="translate(${size * 0.2}, ${size * 0.35})">
        <path d="M ${size * 0.15} ${size * 0.1}
                 L ${size * 0.45} ${size * 0.1}
                 L ${size * 0.5} ${size * 0.2}
                 L ${size * 0.5} ${size * 0.35}
                 L ${size * 0.1} ${size * 0.35}
                 L ${size * 0.1} ${size * 0.2}
                 Z"
              fill="${BRAND_COLORS.white}"
              filter="url(#shadow)"/>

        <!-- Wheels -->
        <circle cx="${size * 0.2}" cy="${size * 0.35}" r="${size * 0.05}" fill="${BRAND_COLORS.dark}"/>
        <circle cx="${size * 0.4}" cy="${size * 0.35}" r="${size * 0.05}" fill="${BRAND_COLORS.dark}"/>
      </g>

      <!-- Location Pin -->
      <g transform="translate(${size * 0.35}, ${size * 0.15})">
        <path d="M ${size * 0.15} ${size * 0.1}
                 C ${size * 0.15} ${size * 0.05}, ${size * 0.2} ${size * 0.05}, ${size * 0.2} ${size * 0.1}
                 C ${size * 0.2} ${size * 0.15}, ${size * 0.175} ${size * 0.2}, ${size * 0.175} ${size * 0.2}
                 L ${size * 0.175} ${size * 0.25}
                 L ${size * 0.175} ${size * 0.2}
                 C ${size * 0.175} ${size * 0.2}, ${size * 0.15} ${size * 0.15}, ${size * 0.15} ${size * 0.1}
                 Z"
              fill="${BRAND_COLORS.danger}"
              opacity="0.9"/>
        <circle cx="${size * 0.175}" cy="${size * 0.1}" r="${size * 0.02}" fill="${BRAND_COLORS.white}"/>
      </g>

      <!-- App Name -->
      <text x="${size * 0.5}" y="${size * 0.8}"
            font-family="SF Pro Display, Helvetica, Arial"
            font-size="${size * 0.12}"
            font-weight="bold"
            fill="${BRAND_COLORS.white}"
            text-anchor="middle">
        OkapiFind
      </text>
    </svg>
  `;

  return sharp(Buffer.from(svg))
    .png()
    .toBuffer();
}

/**
 * Create screenshot with app UI mockup
 */
async function createScreenshot(width, height, screenNumber) {
  const screens = [
    {
      title: 'Find Your Car Instantly',
      subtitle: 'Never lose your parking spot again',
      features: ['Smart Location Tracking', 'One-Tap Save', 'Offline Support'],
    },
    {
      title: 'Smart Parking Detection',
      subtitle: 'Automatically detects when you park',
      features: ['AI-Powered Detection', 'Battery Optimized', 'Works Everywhere'],
    },
    {
      title: 'Never Get a Ticket',
      subtitle: 'Timely reminders for meter expiry',
      features: ['Smart Notifications', 'Street Cleaning Alerts', 'Custom Reminders'],
    },
    {
      title: 'Share with Family',
      subtitle: 'Let loved ones find the car too',
      features: ['Family Sharing', 'Emergency Location', 'Privacy Controls'],
    },
    {
      title: 'Your Data, Protected',
      subtitle: 'Enterprise-grade security',
      features: ['End-to-End Encryption', 'GDPR Compliant', 'Private by Design'],
    },
  ];

  const screen = screens[screenNumber % screens.length];

  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:${BRAND_COLORS.primary};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${BRAND_COLORS.secondary};stop-opacity:1" />
        </linearGradient>
      </defs>

      <!-- Background -->
      <rect width="${width}" height="${height}" fill="url(#bg)"/>

      <!-- Phone Frame -->
      <rect x="${width * 0.1}" y="${height * 0.15}"
            width="${width * 0.8}" height="${height * 0.7}"
            rx="40"
            fill="${BRAND_COLORS.white}"
            stroke="${BRAND_COLORS.dark}"
            stroke-width="2"/>

      <!-- Status Bar -->
      <rect x="${width * 0.1}" y="${height * 0.15}"
            width="${width * 0.8}" height="60"
            rx="40"
            fill="${BRAND_COLORS.dark}"
            opacity="0.1"/>

      <!-- Title -->
      <text x="${width * 0.5}" y="${height * 0.08}"
            font-family="SF Pro Display, Helvetica, Arial"
            font-size="56"
            font-weight="bold"
            fill="${BRAND_COLORS.white}"
            text-anchor="middle">
        ${screen.title}
      </text>

      <!-- Subtitle -->
      <text x="${width * 0.5}" y="${height * 0.11}"
            font-family="SF Pro Display, Helvetica, Arial"
            font-size="32"
            fill="${BRAND_COLORS.white}"
            opacity="0.9"
            text-anchor="middle">
        ${screen.subtitle}
      </text>

      <!-- Map Mockup -->
      <rect x="${width * 0.15}" y="${height * 0.25}"
            width="${width * 0.7}" height="${height * 0.35}"
            fill="${BRAND_COLORS.light}"
            rx="20"/>

      <!-- Features -->
      ${screen.features.map((feature, index) => `
        <g transform="translate(${width * 0.15}, ${height * 0.65 + index * 80})">
          <circle cx="30" cy="30" r="25" fill="${BRAND_COLORS.success}" opacity="0.2"/>
          <text x="30" y="38"
                font-family="SF Pro Display, Helvetica, Arial"
                font-size="24"
                fill="${BRAND_COLORS.success}"
                text-anchor="middle">
            ✓
          </text>
          <text x="80" y="38"
                font-family="SF Pro Display, Helvetica, Arial"
                font-size="28"
                fill="${BRAND_COLORS.dark}">
            ${feature}
          </text>
        </g>
      `).join('')}

      <!-- Bottom CTA -->
      <rect x="${width * 0.2}" y="${height * 0.88}"
            width="${width * 0.6}" height="80"
            rx="40"
            fill="${BRAND_COLORS.white}"/>

      <text x="${width * 0.5}" y="${height * 0.91}"
            font-family="SF Pro Display, Helvetica, Arial"
            font-size="32"
            font-weight="bold"
            fill="${BRAND_COLORS.primary}"
            text-anchor="middle">
        Download Now - It's Free!
      </text>
    </svg>
  `;

  return sharp(Buffer.from(svg))
    .png()
    .toBuffer();
}

/**
 * Create feature graphic for Google Play
 */
async function createFeatureGraphic() {
  const svg = `
    <svg width="${FEATURE_GRAPHIC.width}" height="${FEATURE_GRAPHIC.height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:${BRAND_COLORS.primary};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${BRAND_COLORS.secondary};stop-opacity:1" />
        </linearGradient>
      </defs>

      <!-- Background -->
      <rect width="${FEATURE_GRAPHIC.width}" height="${FEATURE_GRAPHIC.height}" fill="url(#bg)"/>

      <!-- Logo and Title -->
      <text x="100" y="200"
            font-family="SF Pro Display, Helvetica, Arial"
            font-size="72"
            font-weight="bold"
            fill="${BRAND_COLORS.white}">
        OkapiFind
      </text>

      <!-- Tagline -->
      <text x="100" y="280"
            font-family="SF Pro Display, Helvetica, Arial"
            font-size="36"
            fill="${BRAND_COLORS.white}"
            opacity="0.95">
        Never Lose Your Parking Spot Again
      </text>

      <!-- Features -->
      <text x="100" y="380"
            font-family="SF Pro Display, Helvetica, Arial"
            font-size="24"
            fill="${BRAND_COLORS.white}"
            opacity="0.9">
        ✓ Smart Detection  ✓ Family Sharing  ✓ Offline Mode  ✓ Free Forever
      </text>
    </svg>
  `;

  return sharp(Buffer.from(svg))
    .png()
    .toBuffer();
}

/**
 * Generate all assets
 */
async function generateAllAssets() {
  const outputDir = path.join(__dirname, '..', 'assets', 'app-store');

  // Create output directories
  const dirs = [
    path.join(outputDir, 'ios', 'icons'),
    path.join(outputDir, 'ios', 'screenshots'),
    path.join(outputDir, 'android', 'icons'),
    path.join(outputDir, 'android', 'screenshots'),
    path.join(outputDir, 'android', 'feature'),
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  console.log('🎨 Generating App Store Assets...\n');

  // Generate iOS Icons
  console.log('📱 Generating iOS Icons...');
  for (const config of APP_ICON_SIZES.ios) {
    for (const scale of config.scale) {
      const size = config.size * scale;
      const icon = await createBaseIcon(size);
      const fileName = `${config.name}${scale > 1 ? `@${scale}x` : ''}.png`;
      const filePath = path.join(outputDir, 'ios', 'icons', fileName);

      if (config.noAlpha) {
        // App Store icon needs no transparency
        await sharp(icon)
          .flatten({ background: BRAND_COLORS.white })
          .toFile(filePath);
      } else {
        await sharp(icon).toFile(filePath);
      }

      console.log(`  ✓ ${fileName} (${size}x${size})`);
    }
  }

  // Generate Android Icons
  console.log('\n🤖 Generating Android Icons...');
  for (const config of APP_ICON_SIZES.android) {
    const icon = await createBaseIcon(config.size);
    const filePath = path.join(outputDir, 'android', 'icons', `${config.name}.png`);

    // Create directory if it doesn't exist
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    await sharp(icon).toFile(filePath);
    console.log(`  ✓ ${config.name}.png (${config.size}x${config.size})`);
  }

  // Generate iOS Screenshots
  console.log('\n📸 Generating iOS Screenshots...');
  for (const device of SCREENSHOT_SIZES.ios) {
    for (let i = 0; i < 5; i++) {
      const screenshot = await createScreenshot(device.width, device.height, i);
      const fileName = `screenshot-${i + 1}.png`;
      const dir = path.join(outputDir, 'ios', 'screenshots', device.folder);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const filePath = path.join(dir, fileName);
      await sharp(screenshot).toFile(filePath);
      console.log(`  ✓ ${device.name} - ${fileName}`);
    }
  }

  // Generate Android Screenshots
  console.log('\n📸 Generating Android Screenshots...');
  for (const device of SCREENSHOT_SIZES.android) {
    for (let i = 0; i < 5; i++) {
      const screenshot = await createScreenshot(device.width, device.height, i);
      const fileName = `screenshot-${i + 1}.png`;
      const dir = path.join(outputDir, 'android', 'screenshots', device.folder);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const filePath = path.join(dir, fileName);
      await sharp(screenshot).toFile(filePath);
      console.log(`  ✓ ${device.name} - ${fileName}`);
    }
  }

  // Generate Feature Graphic
  console.log('\n🎯 Generating Feature Graphics...');
  const featureGraphic = await createFeatureGraphic();
  await sharp(featureGraphic)
    .toFile(path.join(outputDir, 'android', 'feature', 'feature-graphic.png'));
  console.log('  ✓ Feature Graphic (1024x500)');

  // Generate Promo Graphic
  const promoGraphic = await sharp(featureGraphic)
    .resize(PROMO_GRAPHIC.width, PROMO_GRAPHIC.height)
    .toFile(path.join(outputDir, 'android', 'feature', 'promo-graphic.png'));
  console.log('  ✓ Promo Graphic (180x120)');

  // Generate TV Banner
  const tvBanner = await sharp(featureGraphic)
    .resize(TV_BANNER.width, TV_BANNER.height)
    .toFile(path.join(outputDir, 'android', 'feature', 'tv-banner.png'));
  console.log('  ✓ TV Banner (1280x720)');

  console.log('\n✅ All app store assets generated successfully!');
  console.log(`📁 Assets saved to: ${outputDir}`);
}

// Run the generator
generateAllAssets().catch(error => {
  console.error('❌ Error generating assets:', error);
  process.exit(1);
});