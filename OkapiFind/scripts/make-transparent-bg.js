const sharp = require('sharp');
const path = require('path');

async function makeTransparentBackground() {
  const inputPath = 'C:\\Users\\maito\\Downloads\\okapiFindPhoneScreen.png';
  const outputPath = 'C:\\Users\\maito\\okapifind\\OkapiFind\\public\\promo-screen.png';

  console.log('Making background transparent...');

  // Read the image and convert near-white pixels to transparent
  const image = sharp(inputPath);
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

  // Create new buffer with alpha channel
  const newData = Buffer.alloc(info.width * info.height * 4);

  for (let i = 0; i < info.width * info.height; i++) {
    const srcOffset = i * info.channels;
    const dstOffset = i * 4;

    const r = data[srcOffset];
    const g = data[srcOffset + 1];
    const b = data[srcOffset + 2];

    // Check if pixel is near-white (threshold: 250+)
    const isNearWhite = r >= 250 && g >= 250 && b >= 250;

    newData[dstOffset] = r;
    newData[dstOffset + 1] = g;
    newData[dstOffset + 2] = b;
    newData[dstOffset + 3] = isNearWhite ? 0 : 255; // Transparent if near-white
  }

  await sharp(newData, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4
    }
  })
    .png()
    .toFile(outputPath);

  console.log(`Created transparent background image: ${outputPath}`);

  // Verify
  const result = await sharp(outputPath).metadata();
  console.log(`Output: ${result.width}x${result.height}, channels: ${result.channels}, hasAlpha: ${result.hasAlpha}`);
}

makeTransparentBackground().catch(console.error);
