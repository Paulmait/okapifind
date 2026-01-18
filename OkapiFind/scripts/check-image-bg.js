const sharp = require('sharp');

async function checkImageBackground() {
  const imagePath = 'C:\\Users\\maito\\okapifind\\OkapiFind\\public\\promo-screen.png';

  const image = await sharp(imagePath);
  const metadata = await image.metadata();

  console.log(`Image size: ${metadata.width}x${metadata.height}`);
  console.log(`Channels: ${metadata.channels}`);
  console.log(`Has alpha: ${metadata.hasAlpha}`);

  // Sample corner pixels to check background color
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

  // Top-left corner pixel (first pixel)
  const topLeft = {
    r: data[0],
    g: data[1],
    b: data[2],
    a: metadata.channels === 4 ? data[3] : 255
  };

  // Top-right corner pixel
  const topRightOffset = (metadata.width - 1) * metadata.channels;
  const topRight = {
    r: data[topRightOffset],
    g: data[topRightOffset + 1],
    b: data[topRightOffset + 2],
    a: metadata.channels === 4 ? data[topRightOffset + 3] : 255
  };

  // Bottom-left corner
  const bottomLeftOffset = (metadata.height - 1) * metadata.width * metadata.channels;
  const bottomLeft = {
    r: data[bottomLeftOffset],
    g: data[bottomLeftOffset + 1],
    b: data[bottomLeftOffset + 2],
    a: metadata.channels === 4 ? data[bottomLeftOffset + 3] : 255
  };

  console.log('\nCorner pixel colors (RGB):');
  console.log(`Top-left: rgb(${topLeft.r}, ${topLeft.g}, ${topLeft.b}) alpha: ${topLeft.a}`);
  console.log(`Top-right: rgb(${topRight.r}, ${topRight.g}, ${topRight.b}) alpha: ${topRight.a}`);
  console.log(`Bottom-left: rgb(${bottomLeft.r}, ${bottomLeft.g}, ${bottomLeft.b}) alpha: ${bottomLeft.a}`);

  // Convert to hex
  const toHex = (r, g, b) => '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  console.log(`\nTop-left hex: ${toHex(topLeft.r, topLeft.g, topLeft.b)}`);
  console.log(`Top-right hex: ${toHex(topRight.r, topRight.g, topRight.b)}`);
  console.log(`Bottom-left hex: ${toHex(bottomLeft.r, bottomLeft.g, bottomLeft.b)}`);

  console.log('\n--- Webpage CSS variables ---');
  console.log('--bg: #ffffff (white)');
  console.log('--bg-alt: #f8fafc (very light gray)');
  console.log('Hero gradient: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)');
}

checkImageBackground().catch(console.error);
