const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const screenshotsDir = path.join(__dirname, '..', 'assets', 'app-store', 'ios', 'screenshots');

async function main() {
  // 1. Crop the phone frame image to just the screen
  console.log('1. Cropping phone frame image...');
  const phoneFrameImage = 'C:\\Users\\maito\\Downloads\\okapiFindPhoneScreen.png';

  // Get image metadata first
  const metadata = await sharp(phoneFrameImage).metadata();
  console.log(`Original image: ${metadata.width}x${metadata.height}`);

  // The phone frame image has the screen content inside the frame
  // Based on the image, we need to extract just the screen area
  // Approximate crop values for the screen content (will need adjustment)
  const screenCrop = {
    left: Math.floor(metadata.width * 0.08),   // ~8% from left
    top: Math.floor(metadata.height * 0.025),  // ~2.5% from top
    width: Math.floor(metadata.width * 0.84),  // ~84% width
    height: Math.floor(metadata.height * 0.95) // ~95% height
  };

  const croppedScreenPath = path.join(path.dirname(phoneFrameImage), 'okapiFindScreen-cropped.png');

  await sharp(phoneFrameImage)
    .extract(screenCrop)
    .toFile(croppedScreenPath);

  const croppedMeta = await sharp(croppedScreenPath).metadata();
  console.log(`Cropped screen: ${croppedMeta.width}x${croppedMeta.height} -> ${croppedScreenPath}`);

  // 2. Create iPad 13" screenshots (2048x2732)
  console.log('\n2. Creating iPad 13" screenshots (2048x2732)...');
  const ipadDir = path.join(screenshotsDir, 'ipad-13');

  if (!fs.existsSync(ipadDir)) {
    fs.mkdirSync(ipadDir, { recursive: true });
  }

  // Use the 6.7-inch screenshots as source (highest quality)
  const sourceDir = path.join(screenshotsDir, '6.7-inch');
  const screenshots = fs.readdirSync(sourceDir).filter(f => f.endsWith('.png'));

  for (const screenshot of screenshots) {
    const sourcePath = path.join(sourceDir, screenshot);
    const destPath = path.join(ipadDir, screenshot);

    // For iPad, we'll create a centered layout with the phone screenshot on navy background
    const sourceImage = await sharp(sourcePath).metadata();

    // iPad Pro 12.9" dimensions: 2048x2732
    const ipadWidth = 2048;
    const ipadHeight = 2732;

    // Scale the phone screenshot to fit nicely on iPad (about 70% height)
    const targetHeight = Math.floor(ipadHeight * 0.75);
    const scaleFactor = targetHeight / sourceImage.height;
    const targetWidth = Math.floor(sourceImage.width * scaleFactor);

    // Create navy background and composite the screenshot centered
    const background = await sharp({
      create: {
        width: ipadWidth,
        height: ipadHeight,
        channels: 4,
        background: { r: 15, g: 27, b: 42, alpha: 1 } // Navy #0F1B2A
      }
    }).png().toBuffer();

    const scaledScreenshot = await sharp(sourcePath)
      .resize(targetWidth, targetHeight, { fit: 'inside' })
      .toBuffer();

    const scaledMeta = await sharp(scaledScreenshot).metadata();

    await sharp(background)
      .composite([{
        input: scaledScreenshot,
        left: Math.floor((ipadWidth - scaledMeta.width) / 2),
        top: Math.floor((ipadHeight - scaledMeta.height) / 2)
      }])
      .toFile(destPath);

    console.log(`Created: ${destPath}`);
  }

  // 3. Create 1024x1024 subscription promotional image
  console.log('\n3. Creating 1024x1024 subscription image...');
  const subscriptionDir = path.join(screenshotsDir, '..', 'subscription');

  if (!fs.existsSync(subscriptionDir)) {
    fs.mkdirSync(subscriptionDir, { recursive: true });
  }

  // Use the app icon or create a promotional image
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
  const subscriptionImagePath = path.join(subscriptionDir, 'subscription-promo-1024x1024.png');

  // Create a promotional image with the app icon centered on navy background
  const iconMeta = await sharp(iconPath).metadata();

  // Scale icon to about 60% of the 1024 square
  const iconSize = 614;
  const scaledIcon = await sharp(iconPath)
    .resize(iconSize, iconSize, { fit: 'contain' })
    .toBuffer();

  const promoBackground = await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 15, g: 27, b: 42, alpha: 1 } // Navy #0F1B2A
    }
  }).png().toBuffer();

  await sharp(promoBackground)
    .composite([{
      input: scaledIcon,
      left: Math.floor((1024 - iconSize) / 2),
      top: Math.floor((1024 - iconSize) / 2)
    }])
    .toFile(subscriptionImagePath);

  console.log(`Created: ${subscriptionImagePath}`);

  console.log('\nAll assets processed successfully!');
}

main().catch(console.error);
