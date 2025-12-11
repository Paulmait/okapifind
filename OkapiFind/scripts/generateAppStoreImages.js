/**
 * App Store Screenshot Generator for OkapiFind
 * Generates required iOS App Store screenshots
 *
 * Required sizes:
 * - 6.5" iPhone: 1242 × 2688px (portrait) or 2688 × 1242px (landscape)
 * - 6.7" iPhone: 1284 × 2778px (portrait) or 2778 × 1284px (landscape)
 *
 * Run: node scripts/generateAppStoreImages.js
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Brand colors from your app
const COLORS = {
  primary: '#4A90E2',      // Blue
  secondary: '#FFD700',    // Gold
  background: '#0F1B2A',   // Dark blue
  white: '#FFFFFF',
  text: '#FFFFFF',
  accent: '#34C759',       // Green
};

// Screenshot configurations
const SCREENSHOTS = [
  {
    id: 1,
    title: 'Save Your Spot',
    subtitle: 'One tap to remember where you parked',
    icon: 'parking',
    gradient: ['#4A90E2', '#2E5A8E'],
  },
  {
    id: 2,
    title: 'Find Your Car',
    subtitle: 'Turn-by-turn walking directions',
    icon: 'navigation',
    gradient: ['#34C759', '#228B22'],
  },
  {
    id: 3,
    title: 'Works Offline',
    subtitle: 'Even in underground garages',
    icon: 'offline',
    gradient: ['#FF9500', '#CC7700'],
  },
  {
    id: 4,
    title: 'Smart Alerts',
    subtitle: 'Never get a parking ticket again',
    icon: 'alert',
    gradient: ['#FF3B30', '#CC2F26'],
  },
  {
    id: 5,
    title: 'Parking History',
    subtitle: 'Track all your parking spots',
    icon: 'history',
    gradient: ['#AF52DE', '#8B42B2'],
  },
];

// Device sizes
const SIZES = {
  // iPhone 6.5" (iPhone 11 Pro Max, XS Max)
  'iphone-6.5': { width: 1242, height: 2688, name: '6.5-inch' },
  'iphone-6.5-landscape': { width: 2688, height: 1242, name: '6.5-inch-landscape' },
  // iPhone 6.7" (iPhone 14 Pro Max, 15 Pro Max)
  'iphone-6.7': { width: 1284, height: 2778, name: '6.7-inch' },
  'iphone-6.7-landscape': { width: 2778, height: 1284, name: '6.7-inch-landscape' },
  // iPad Pro 12.9" (3rd gen and later)
  'ipad-12.9': { width: 2048, height: 2732, name: 'iPad-12.9-inch' },
  'ipad-12.9-landscape': { width: 2732, height: 2048, name: 'iPad-12.9-inch-landscape' },
  // iPad Pro 11"
  'ipad-11': { width: 1668, height: 2388, name: 'iPad-11-inch' },
  'ipad-11-landscape': { width: 2388, height: 1668, name: 'iPad-11-inch-landscape' },
};

// Create output directory
const outputDir = path.join(__dirname, '..', 'app-store-assets');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// SVG icons
const ICONS = {
  parking: `<svg viewBox="0 0 100 100" fill="white">
    <circle cx="50" cy="50" r="45" fill="none" stroke="white" stroke-width="4"/>
    <text x="50" y="68" font-size="50" font-weight="bold" text-anchor="middle" fill="white">P</text>
  </svg>`,

  navigation: `<svg viewBox="0 0 100 100" fill="white">
    <polygon points="50,10 90,90 50,70 10,90" fill="white"/>
  </svg>`,

  offline: `<svg viewBox="0 0 100 100" fill="white">
    <circle cx="50" cy="60" r="30" fill="none" stroke="white" stroke-width="4"/>
    <path d="M30 40 Q50 20 70 40" fill="none" stroke="white" stroke-width="4"/>
    <path d="M20 30 Q50 5 80 30" fill="none" stroke="white" stroke-width="4"/>
    <line x1="20" y1="80" x2="80" y2="20" stroke="white" stroke-width="4"/>
  </svg>`,

  alert: `<svg viewBox="0 0 100 100" fill="white">
    <polygon points="50,10 95,90 5,90" fill="none" stroke="white" stroke-width="4"/>
    <line x1="50" y1="35" x2="50" y2="60" stroke="white" stroke-width="6" stroke-linecap="round"/>
    <circle cx="50" cy="75" r="4" fill="white"/>
  </svg>`,

  history: `<svg viewBox="0 0 100 100" fill="white">
    <circle cx="50" cy="50" r="40" fill="none" stroke="white" stroke-width="4"/>
    <line x1="50" y1="50" x2="50" y2="25" stroke="white" stroke-width="4" stroke-linecap="round"/>
    <line x1="50" y1="50" x2="70" y2="50" stroke="white" stroke-width="4" stroke-linecap="round"/>
    <path d="M15 50 L5 50 L5 60" fill="none" stroke="white" stroke-width="4" stroke-linecap="round"/>
  </svg>`,
};

async function createScreenshot(screenshot, size, sizeKey) {
  const { width, height } = size;
  const isLandscape = width > height;

  // Calculate dimensions
  const iconSize = isLandscape ? Math.min(width, height) * 0.25 : width * 0.3;
  const titleSize = isLandscape ? 72 : 84;
  const subtitleSize = isLandscape ? 42 : 48;

  // Phone mockup dimensions
  const phoneWidth = isLandscape ? height * 0.35 : width * 0.7;
  const phoneHeight = isLandscape ? height * 0.7 : height * 0.5;
  const phoneX = isLandscape ? width * 0.55 : (width - phoneWidth) / 2;
  const phoneY = isLandscape ? (height - phoneHeight) / 2 : height * 0.42;

  // Text positions
  const textX = isLandscape ? width * 0.28 : width / 2;
  const titleY = isLandscape ? height * 0.35 : height * 0.12;
  const subtitleY = isLandscape ? height * 0.45 : height * 0.18;
  const iconY = isLandscape ? height * 0.65 : height * 0.28;

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${screenshot.gradient[0]};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${screenshot.gradient[1]};stop-opacity:1" />
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="20" flood-opacity="0.3"/>
        </filter>
      </defs>

      <!-- Background -->
      <rect width="${width}" height="${height}" fill="url(#bg-gradient)"/>

      <!-- Title -->
      <text x="${textX}" y="${titleY}"
            font-family="SF Pro Display, -apple-system, Arial, sans-serif"
            font-size="${titleSize}"
            font-weight="bold"
            fill="white"
            text-anchor="${isLandscape ? 'middle' : 'middle'}">
        ${screenshot.title}
      </text>

      <!-- Subtitle -->
      <text x="${textX}" y="${subtitleY}"
            font-family="SF Pro Display, -apple-system, Arial, sans-serif"
            font-size="${subtitleSize}"
            fill="rgba(255,255,255,0.9)"
            text-anchor="${isLandscape ? 'middle' : 'middle'}">
        ${screenshot.subtitle}
      </text>

      <!-- Icon -->
      <g transform="translate(${textX - iconSize/2}, ${iconY}) scale(${iconSize/100})">
        ${ICONS[screenshot.icon]}
      </g>

      <!-- Phone mockup -->
      <g filter="url(#shadow)">
        <rect x="${phoneX}" y="${phoneY}"
              width="${phoneWidth}" height="${phoneHeight}"
              rx="30" ry="30"
              fill="${COLORS.background}"/>
        <rect x="${phoneX + 8}" y="${phoneY + 8}"
              width="${phoneWidth - 16}" height="${phoneHeight - 16}"
              rx="22" ry="22"
              fill="#1a2a3a"/>

        <!-- Phone screen content - map mockup -->
        <rect x="${phoneX + 20}" y="${phoneY + 60}"
              width="${phoneWidth - 40}" height="${phoneHeight - 120}"
              rx="10" ry="10"
              fill="#2a3a4a"/>

        <!-- Map pin -->
        <g transform="translate(${phoneX + phoneWidth/2 - 15}, ${phoneY + phoneHeight/2 - 40})">
          <path d="M15 0 C6.7 0 0 6.7 0 15 C0 25 15 40 15 40 C15 40 30 25 30 15 C30 6.7 23.3 0 15 0 Z"
                fill="${COLORS.primary}"/>
          <circle cx="15" cy="15" r="6" fill="white"/>
        </g>

        <!-- Bottom button -->
        <rect x="${phoneX + phoneWidth/2 - 60}" y="${phoneY + phoneHeight - 50}"
              width="120" height="36"
              rx="18" ry="18"
              fill="${COLORS.primary}"/>
        <text x="${phoneX + phoneWidth/2}" y="${phoneY + phoneHeight - 26}"
              font-family="SF Pro Display, -apple-system, Arial, sans-serif"
              font-size="16"
              font-weight="600"
              fill="white"
              text-anchor="middle">
          Find My Car
        </text>

        <!-- Status bar mockup -->
        <text x="${phoneX + 25}" y="${phoneY + 35}"
              font-family="SF Pro Display, -apple-system, Arial, sans-serif"
              font-size="14"
              fill="white">9:41</text>

        <!-- Notch -->
        <rect x="${phoneX + phoneWidth/2 - 50}" y="${phoneY + 8}"
              width="100" height="24"
              rx="12" ry="12"
              fill="${COLORS.background}"/>
      </g>

      <!-- App name badge -->
      <g transform="translate(${width/2 - 80}, ${height - 80})">
        <rect width="160" height="44" rx="22" fill="rgba(255,255,255,0.2)"/>
        <text x="80" y="29"
              font-family="SF Pro Display, -apple-system, Arial, sans-serif"
              font-size="20"
              font-weight="600"
              fill="white"
              text-anchor="middle">
          OkapiFind
        </text>
      </g>
    </svg>
  `;

  const filename = `screenshot-${screenshot.id}-${sizeKey}.png`;
  const filepath = path.join(outputDir, filename);

  await sharp(Buffer.from(svg))
    .png()
    .toFile(filepath);

  console.log(`Created: ${filename}`);
  return filepath;
}

async function generateAllScreenshots() {
  console.log('Generating App Store screenshots...\n');
  console.log(`Output directory: ${outputDir}\n`);

  const generated = [];

  for (const screenshot of SCREENSHOTS) {
    for (const [sizeKey, size] of Object.entries(SIZES)) {
      const filepath = await createScreenshot(screenshot, size, sizeKey);
      generated.push(filepath);
    }
  }

  console.log(`\n✅ Generated ${generated.length} screenshots`);
  console.log(`\nFiles saved to: ${outputDir}`);
  console.log('\nRequired sizes for App Store:');
  console.log('  iPhone:');
  console.log('    - 6.5" Display: 1242 × 2688 px (portrait), 2688 × 1242 px (landscape)');
  console.log('    - 6.7" Display: 1284 × 2778 px (portrait), 2778 × 1284 px (landscape)');
  console.log('  iPad:');
  console.log('    - 12.9" Display: 2048 × 2732 px (portrait), 2732 × 2048 px (landscape)');
  console.log('    - 11" Display: 1668 × 2388 px (portrait), 2388 × 1668 px (landscape)');

  return generated;
}

// Run
generateAllScreenshots().catch(console.error);
