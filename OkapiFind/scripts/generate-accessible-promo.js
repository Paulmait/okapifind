/**
 * Generate accessible promotional images with teal/green color scheme
 * For better visibility for color-blind users and various environments
 */

const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

// Accessible color palette - Teal/Cyan theme
const COLORS = {
  // Primary teal - visible to most color blind users
  teal: '#00BFA5',
  tealDark: '#00897B',
  tealLight: '#B2DFDB',

  // Background options
  darkNavy: '#0F1B2A',
  darkTeal: '#004D40',

  // Text colors
  white: '#FFFFFF',
  lightGray: '#E0E0E0',

  // Accent
  gold: '#FFD700',
  cyan: '#00E5FF',
};

// Create subscription promo image with teal theme (1024x1024)
async function createTealSubscriptionPromo() {
  const width = 1024;
  const height = 1024;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Gradient background - dark teal to navy
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, COLORS.darkTeal);
  gradient.addColorStop(1, COLORS.darkNavy);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Draw circular badge/coin
  const centerX = width / 2;
  const centerY = height / 2 - 80;
  const radius = 180;

  // Outer ring - teal glow
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius + 15, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.teal;
  ctx.fill();

  // Inner circle - gradient
  const coinGradient = ctx.createRadialGradient(
    centerX - 40, centerY - 40, 0,
    centerX, centerY, radius
  );
  coinGradient.addColorStop(0, '#26A69A');
  coinGradient.addColorStop(0.5, COLORS.teal);
  coinGradient.addColorStop(1, COLORS.tealDark);

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fillStyle = coinGradient;
  ctx.fill();

  // Inner border
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius - 15, 0, Math.PI * 2);
  ctx.strokeStyle = COLORS.tealLight;
  ctx.lineWidth = 4;
  ctx.stroke();

  // Car icon (simplified)
  ctx.fillStyle = COLORS.white;
  // Car body
  ctx.beginPath();
  ctx.roundRect(centerX - 80, centerY - 20, 160, 60, 15);
  ctx.fill();

  // Car roof
  ctx.beginPath();
  ctx.roundRect(centerX - 50, centerY - 50, 100, 40, 10);
  ctx.fill();

  // Windows (cut out)
  ctx.fillStyle = COLORS.tealDark;
  ctx.beginPath();
  ctx.roundRect(centerX - 40, centerY - 45, 35, 30, 5);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(centerX + 5, centerY - 45, 35, 30, 5);
  ctx.fill();

  // Wheels
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(centerX - 50, centerY + 40, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(centerX + 50, centerY + 40, 20, 0, Math.PI * 2);
  ctx.fill();

  // Navigation arrow
  ctx.fillStyle = COLORS.cyan;
  ctx.beginPath();
  ctx.moveTo(centerX + 60, centerY - 60);
  ctx.lineTo(centerX + 100, centerY - 20);
  ctx.lineTo(centerX + 75, centerY - 20);
  ctx.lineTo(centerX + 75, centerY + 10);
  ctx.lineTo(centerX + 85, centerY + 10);
  ctx.lineTo(centerX + 60, centerY - 60);
  ctx.fill();

  // App name
  ctx.fillStyle = COLORS.white;
  ctx.font = 'bold 64px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('OkapiFind', centerX, centerY + radius + 80);

  // Premium text
  ctx.fillStyle = COLORS.teal;
  ctx.font = 'bold 48px Arial, sans-serif';
  ctx.fillText('Premium', centerX, centerY + radius + 150);

  // Tagline
  ctx.fillStyle = COLORS.lightGray;
  ctx.font = '28px Arial, sans-serif';
  ctx.fillText('Accessible for Everyone', centerX, centerY + radius + 200);

  return canvas;
}

// Create promotional screen content with teal theme
async function createTealPromoScreen() {
  const width = 540;
  const height = 720;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = COLORS.darkNavy;
  ctx.fillRect(0, 0, width, height);

  // Phone frame simulation
  ctx.strokeStyle = '#1A2B3D';
  ctx.lineWidth = 3;
  ctx.roundRect(20, 20, width - 40, height - 40, 30);
  ctx.stroke();

  // Header area
  ctx.fillStyle = COLORS.darkTeal;
  ctx.fillRect(30, 30, width - 60, 80);

  // Logo and app name in header
  ctx.fillStyle = COLORS.teal;
  ctx.beginPath();
  ctx.arc(70, 70, 25, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = COLORS.white;
  ctx.font = 'bold 28px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('OkapiFind', 110, 78);

  ctx.fillStyle = COLORS.lightGray;
  ctx.font = '16px Arial, sans-serif';
  ctx.fillText('Never lose your car', 110, 100);

  // Map area simulation
  ctx.fillStyle = '#E8F5E9';
  ctx.fillRect(30, 120, width - 60, 350);

  // Road lines
  ctx.strokeStyle = '#90A4AE';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 5]);
  ctx.beginPath();
  ctx.moveTo(width / 2, 150);
  ctx.lineTo(width / 2, 300);
  ctx.lineTo(width / 2 + 80, 300);
  ctx.lineTo(width / 2 + 80, 440);
  ctx.stroke();
  ctx.setLineDash([]);

  // User location (blue circle)
  ctx.fillStyle = '#2196F3';
  ctx.beginPath();
  ctx.arc(width / 2, 150, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLORS.white;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Car location (TEAL instead of green - accessible!)
  ctx.fillStyle = COLORS.teal;
  ctx.beginPath();
  ctx.arc(width / 2 + 80, 440, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLORS.white;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Bottom card
  ctx.fillStyle = COLORS.white;
  ctx.roundRect(30, 490, width - 60, 180, [0, 0, 20, 20]);
  ctx.fill();

  // Card content
  ctx.fillStyle = '#333';
  ctx.font = 'bold 24px Arial, sans-serif';
  ctx.fillText('Your Car', 50, 530);

  ctx.fillStyle = '#666';
  ctx.font = '18px Arial, sans-serif';
  ctx.fillText('250m away  \u2022  3 min walk', 50, 560);

  // Navigate button - TEAL
  ctx.fillStyle = COLORS.teal;
  ctx.roundRect(50, 590, width - 100, 50, 25);
  ctx.fill();

  ctx.fillStyle = COLORS.white;
  ctx.font = 'bold 20px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Navigate', width / 2, 622);

  return canvas;
}

// Create dark mode promotional image
async function createDarkModePromo() {
  const width = 1024;
  const height = 1024;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Pure dark background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  // Subtle gradient overlay
  const gradient = ctx.createRadialGradient(
    width / 2, height / 2, 0,
    width / 2, height / 2, width / 2
  );
  gradient.addColorStop(0, 'rgba(0, 191, 165, 0.1)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Glowing teal circle
  const centerX = width / 2;
  const centerY = height / 2 - 50;

  // Outer glow
  for (let i = 5; i > 0; i--) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, 180 + i * 10, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0, 191, 165, ${0.05 * i})`;
    ctx.fill();
  }

  // Main circle
  ctx.beginPath();
  ctx.arc(centerX, centerY, 180, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.teal;
  ctx.fill();

  // Inner dark circle
  ctx.beginPath();
  ctx.arc(centerX, centerY, 150, 0, Math.PI * 2);
  ctx.fillStyle = '#004D40';
  ctx.fill();

  // Car silhouette
  ctx.fillStyle = COLORS.cyan;
  ctx.beginPath();
  ctx.roundRect(centerX - 60, centerY - 10, 120, 45, 10);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(centerX - 35, centerY - 35, 70, 30, 8);
  ctx.fill();

  // Location pin
  ctx.fillStyle = COLORS.white;
  ctx.beginPath();
  ctx.moveTo(centerX + 50, centerY - 50);
  ctx.lineTo(centerX + 70, centerY - 20);
  ctx.lineTo(centerX + 30, centerY - 20);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(centerX + 50, centerY - 55, 15, 0, Math.PI * 2);
  ctx.fill();

  // Text
  ctx.fillStyle = COLORS.white;
  ctx.font = 'bold 72px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('OkapiFind', centerX, centerY + 280);

  ctx.fillStyle = COLORS.teal;
  ctx.font = '36px Arial, sans-serif';
  ctx.fillText('Dark Mode', centerX, centerY + 340);

  ctx.fillStyle = COLORS.lightGray;
  ctx.font = '24px Arial, sans-serif';
  ctx.fillText('Easy on your eyes, day or night', centerX, centerY + 390);

  return canvas;
}

// Create high contrast promotional image
async function createHighContrastPromo() {
  const width = 1024;
  const height = 1024;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Pure black background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  const centerX = width / 2;
  const centerY = height / 2 - 50;

  // High contrast white ring
  ctx.strokeStyle = COLORS.white;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(centerX, centerY, 190, 0, Math.PI * 2);
  ctx.stroke();

  // Bright cyan fill
  ctx.beginPath();
  ctx.arc(centerX, centerY, 175, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.cyan;
  ctx.fill();

  // Black inner for contrast
  ctx.beginPath();
  ctx.arc(centerX, centerY, 140, 0, Math.PI * 2);
  ctx.fillStyle = '#000000';
  ctx.fill();

  // White car icon
  ctx.fillStyle = COLORS.white;
  ctx.beginPath();
  ctx.roundRect(centerX - 70, centerY - 15, 140, 50, 12);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(centerX - 45, centerY - 45, 90, 35, 8);
  ctx.fill();

  // Cyan arrow
  ctx.fillStyle = COLORS.cyan;
  ctx.beginPath();
  ctx.moveTo(centerX + 55, centerY - 55);
  ctx.lineTo(centerX + 85, centerY - 15);
  ctx.lineTo(centerX + 25, centerY - 15);
  ctx.closePath();
  ctx.fill();

  // Text - maximum contrast
  ctx.fillStyle = COLORS.white;
  ctx.font = 'bold 80px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('OkapiFind', centerX, centerY + 280);

  ctx.fillStyle = COLORS.cyan;
  ctx.font = 'bold 40px Arial, sans-serif';
  ctx.fillText('HIGH CONTRAST', centerX, centerY + 340);

  ctx.fillStyle = COLORS.white;
  ctx.font = '28px Arial, sans-serif';
  ctx.fillText('Maximum Visibility Mode', centerX, centerY + 390);

  return canvas;
}

async function main() {
  const outputDir = path.join(__dirname, '..', 'assets', 'app-store', 'ios', 'promotional');

  // Ensure directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('Generating accessible promotional images...\n');

  // Generate teal subscription promo
  console.log('1. Creating teal subscription promo (1024x1024)...');
  const tealPromo = await createTealSubscriptionPromo();
  const tealPromoPath = path.join(outputDir, 'subscription-promo-teal-1024x1024.png');
  fs.writeFileSync(tealPromoPath, tealPromo.toBuffer('image/png'));
  console.log(`   Saved: ${tealPromoPath}`);

  // Generate teal promo screen
  console.log('2. Creating teal promo screen content...');
  const tealScreen = await createTealPromoScreen();
  const tealScreenPath = path.join(outputDir, 'promo-screen-teal.png');
  fs.writeFileSync(tealScreenPath, tealScreen.toBuffer('image/png'));
  console.log(`   Saved: ${tealScreenPath}`);

  // Generate dark mode promo
  console.log('3. Creating dark mode promo (1024x1024)...');
  const darkPromo = await createDarkModePromo();
  const darkPromoPath = path.join(outputDir, 'subscription-promo-dark-1024x1024.png');
  fs.writeFileSync(darkPromoPath, darkPromo.toBuffer('image/png'));
  console.log(`   Saved: ${darkPromoPath}`);

  // Generate high contrast promo
  console.log('4. Creating high contrast promo (1024x1024)...');
  const highContrastPromo = await createHighContrastPromo();
  const highContrastPath = path.join(outputDir, 'subscription-promo-highcontrast-1024x1024.png');
  fs.writeFileSync(highContrastPath, highContrastPromo.toBuffer('image/png'));
  console.log(`   Saved: ${highContrastPath}`);

  console.log('\n All accessible promotional images generated successfully!');
  console.log('\nImages created:');
  console.log('  - subscription-promo-teal-1024x1024.png (Teal theme for color blindness)');
  console.log('  - promo-screen-teal.png (Teal app preview)');
  console.log('  - subscription-promo-dark-1024x1024.png (Dark mode)');
  console.log('  - subscription-promo-highcontrast-1024x1024.png (High contrast)');
}

main().catch(console.error);
