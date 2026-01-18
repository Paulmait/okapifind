const sharp = require('sharp');
const path = require('path');

async function createSubscriptionImage() {
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
  const outputPath = path.join(__dirname, '..', 'assets', 'app-store', 'ios', 'subscription', 'subscription-promo-1024x1024.png');

  console.log('Creating subscription promotional image...');

  // Navy background color
  const navyColor = { r: 15, g: 27, b: 42, alpha: 1 }; // #0F1B2A

  // Create 1024x1024 navy background
  const background = await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: navyColor
    }
  }).png().toBuffer();

  // Scale icon to 700x700 so OkapiFind text is visible
  const iconSize = 700;
  const scaledIcon = await sharp(iconPath)
    .resize(iconSize, iconSize, { fit: 'contain' })
    .toBuffer();

  // Create text as SVG - just "Premium" below the icon
  const textSvg = `
    <svg width="1024" height="100">
      <style>
        .premium {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 64px;
          font-weight: 700;
          fill: #FFD700;
        }
      </style>
      <text x="512" y="70" text-anchor="middle" class="premium">Premium</text>
    </svg>
  `;

  const textBuffer = Buffer.from(textSvg);

  // Composite: larger icon centered, "Premium" text below
  const result = await sharp(background)
    .composite([
      {
        input: scaledIcon,
        left: Math.floor((1024 - iconSize) / 2),
        top: 100  // Position icon near top to make room for text
      },
      {
        input: textBuffer,
        left: 0,
        top: 850  // Position "Premium" at bottom
      }
    ])
    .toFile(outputPath);

  console.log(`Created: ${outputPath}`);

  // Verify
  const meta = await sharp(outputPath).metadata();
  console.log(`Size: ${meta.width}x${meta.height}`);
}

createSubscriptionImage().catch(console.error);
