/**
 * Generate Dark Theme App Icon for OkapiFind
 * Uses teal/navy color scheme for better visibility and accessibility
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// Dark accessible color palette
const COLORS = {
  background: '#0F1B2A',    // Dark navy
  gradientTop: '#004D40',   // Dark teal
  gradientBottom: '#0F1B2A', // Navy
  teal: '#00BFA5',          // Primary teal
  tealLight: '#4DD0B6',     // Light teal for highlights
  cyan: '#00E5FF',          // Bright cyan for accents
  white: '#FFFFFF',
};

// Generate main app icon (1024x1024)
function generateAppIcon(size = 1024) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const scale = size / 1024;

  // Background gradient
  const bgGradient = ctx.createLinearGradient(0, 0, 0, size);
  bgGradient.addColorStop(0, COLORS.gradientTop);
  bgGradient.addColorStop(1, COLORS.gradientBottom);
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, size, size);

  const centerX = size / 2;
  const centerY = size / 2;

  // Outer glow effect
  for (let i = 5; i > 0; i--) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, (380 + i * 15) * scale, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0, 191, 165, ${0.03 * i})`;
    ctx.fill();
  }

  // Main circle - teal gradient
  const circleGradient = ctx.createRadialGradient(
    centerX - 100 * scale, centerY - 100 * scale, 0,
    centerX, centerY, 350 * scale
  );
  circleGradient.addColorStop(0, COLORS.tealLight);
  circleGradient.addColorStop(0.5, COLORS.teal);
  circleGradient.addColorStop(1, '#00897B');

  ctx.beginPath();
  ctx.arc(centerX, centerY, 350 * scale, 0, Math.PI * 2);
  ctx.fillStyle = circleGradient;
  ctx.fill();

  // Inner ring
  ctx.beginPath();
  ctx.arc(centerX, centerY, 310 * scale, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 4 * scale;
  ctx.stroke();

  // Inner dark circle
  ctx.beginPath();
  ctx.arc(centerX, centerY, 280 * scale, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.background;
  ctx.fill();

  // Car icon - white
  ctx.fillStyle = COLORS.white;

  // Car body
  const carX = centerX - 120 * scale;
  const carY = centerY - 20 * scale;
  const carWidth = 240 * scale;
  const carHeight = 80 * scale;
  const carRadius = 20 * scale;

  ctx.beginPath();
  ctx.moveTo(carX + carRadius, carY);
  ctx.lineTo(carX + carWidth - carRadius, carY);
  ctx.quadraticCurveTo(carX + carWidth, carY, carX + carWidth, carY + carRadius);
  ctx.lineTo(carX + carWidth, carY + carHeight - carRadius);
  ctx.quadraticCurveTo(carX + carWidth, carY + carHeight, carX + carWidth - carRadius, carY + carHeight);
  ctx.lineTo(carX + carRadius, carY + carHeight);
  ctx.quadraticCurveTo(carX, carY + carHeight, carX, carY + carHeight - carRadius);
  ctx.lineTo(carX, carY + carRadius);
  ctx.quadraticCurveTo(carX, carY, carX + carRadius, carY);
  ctx.fill();

  // Car roof
  const roofX = centerX - 80 * scale;
  const roofY = centerY - 80 * scale;
  const roofWidth = 160 * scale;
  const roofHeight = 65 * scale;
  const roofRadius = 15 * scale;

  ctx.beginPath();
  ctx.moveTo(roofX + roofRadius, roofY);
  ctx.lineTo(roofX + roofWidth - roofRadius, roofY);
  ctx.quadraticCurveTo(roofX + roofWidth, roofY, roofX + roofWidth, roofY + roofRadius);
  ctx.lineTo(roofX + roofWidth, roofY + roofHeight);
  ctx.lineTo(roofX, roofY + roofHeight);
  ctx.lineTo(roofX, roofY + roofRadius);
  ctx.quadraticCurveTo(roofX, roofY, roofX + roofRadius, roofY);
  ctx.fill();

  // Windows (cut out)
  ctx.fillStyle = COLORS.background;
  // Left window
  ctx.beginPath();
  ctx.roundRect(
    centerX - 70 * scale, centerY - 70 * scale,
    60 * scale, 45 * scale,
    8 * scale
  );
  ctx.fill();
  // Right window
  ctx.beginPath();
  ctx.roundRect(
    centerX + 10 * scale, centerY - 70 * scale,
    60 * scale, 45 * scale,
    8 * scale
  );
  ctx.fill();

  // Wheels
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(centerX - 70 * scale, centerY + 60 * scale, 28 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(centerX + 70 * scale, centerY + 60 * scale, 28 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Wheel rims
  ctx.fillStyle = '#666';
  ctx.beginPath();
  ctx.arc(centerX - 70 * scale, centerY + 60 * scale, 15 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(centerX + 70 * scale, centerY + 60 * scale, 15 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Navigation arrow - cyan
  ctx.fillStyle = COLORS.cyan;
  ctx.beginPath();
  const arrowX = centerX + 90 * scale;
  const arrowY = centerY - 100 * scale;
  ctx.moveTo(arrowX, arrowY - 50 * scale);
  ctx.lineTo(arrowX + 35 * scale, arrowY + 20 * scale);
  ctx.lineTo(arrowX + 10 * scale, arrowY + 10 * scale);
  ctx.lineTo(arrowX + 10 * scale, arrowY + 50 * scale);
  ctx.lineTo(arrowX - 10 * scale, arrowY + 50 * scale);
  ctx.lineTo(arrowX - 10 * scale, arrowY + 10 * scale);
  ctx.lineTo(arrowX - 35 * scale, arrowY + 20 * scale);
  ctx.closePath();
  ctx.fill();

  return canvas;
}

// Generate all required iOS icon sizes
const IOS_ICON_SIZES = [
  { name: 'Icon-20@2x.png', size: 40 },
  { name: 'Icon-20@3x.png', size: 60 },
  { name: 'Icon-29@2x.png', size: 58 },
  { name: 'Icon-29@3x.png', size: 87 },
  { name: 'Icon-40@2x.png', size: 80 },
  { name: 'Icon-40@3x.png', size: 120 },
  { name: 'Icon-60@2x.png', size: 120 },
  { name: 'Icon-60@3x.png', size: 180 },
  { name: 'Icon-76.png', size: 76 },
  { name: 'Icon-76@2x.png', size: 152 },
  { name: 'Icon-83.5@2x.png', size: 167 },
  { name: 'Icon-1024.png', size: 1024 },
];

async function main() {
  const assetsDir = path.join(__dirname, '..', 'assets');
  const iconDir = path.join(assetsDir, 'app-store', 'ios', 'icons');

  // Ensure directories exist
  if (!fs.existsSync(iconDir)) {
    fs.mkdirSync(iconDir, { recursive: true });
  }

  console.log('\n========================================');
  console.log('Generating Dark Theme App Icons');
  console.log('========================================\n');

  // Generate main icon (1024x1024)
  console.log('1. Generating main app icon (1024x1024)...');
  const mainIcon = generateAppIcon(1024);
  const mainIconPath = path.join(assetsDir, 'icon.png');
  fs.writeFileSync(mainIconPath, mainIcon.toBuffer('image/png'));
  console.log(`   Saved: ${mainIconPath}`);

  // Copy to App Store location
  const appStoreIconPath = path.join(iconDir, 'Icon-1024.png');
  fs.writeFileSync(appStoreIconPath, mainIcon.toBuffer('image/png'));
  console.log(`   Saved: ${appStoreIconPath}`);

  // Generate adaptive icon for Android
  console.log('\n2. Generating adaptive icon for Android...');
  const adaptiveIcon = generateAppIcon(1024);
  const adaptiveIconPath = path.join(assetsDir, 'adaptive-icon.png');
  fs.writeFileSync(adaptiveIconPath, adaptiveIcon.toBuffer('image/png'));
  console.log(`   Saved: ${adaptiveIconPath}`);

  // Generate all iOS icon sizes
  console.log('\n3. Generating iOS icon sizes...');
  for (const iconConfig of IOS_ICON_SIZES) {
    const icon = generateAppIcon(iconConfig.size);
    const iconPath = path.join(iconDir, iconConfig.name);
    fs.writeFileSync(iconPath, icon.toBuffer('image/png'));
    console.log(`   Generated: ${iconConfig.name} (${iconConfig.size}x${iconConfig.size})`);
  }

  // Generate favicon for web
  console.log('\n4. Generating web favicon...');
  const favicon = generateAppIcon(196);
  const faviconPath = path.join(assetsDir, 'favicon.png');
  fs.writeFileSync(faviconPath, favicon.toBuffer('image/png'));
  console.log(`   Saved: ${faviconPath}`);

  console.log('\n========================================');
  console.log('All icons generated successfully!');
  console.log('========================================');
  console.log('\nColor scheme: Dark Navy + Teal');
  console.log('- Background: #0F1B2A (Dark Navy)');
  console.log('- Primary: #00BFA5 (Teal)');
  console.log('- Accent: #00E5FF (Cyan)');
  console.log('- Icons: White for maximum contrast');
  console.log('\nThis color scheme is:');
  console.log('- Accessible for color-blind users');
  console.log('- High contrast for visibility');
  console.log('- Works well on both light and dark backgrounds');
  console.log('');
}

main().catch(console.error);
