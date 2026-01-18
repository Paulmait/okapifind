const sharp = require('sharp');
const path = require('path');

async function main() {
  const phoneFrameImage = 'C:\\Users\\maito\\Downloads\\okapiFindPhoneScreen.png';

  // Get image metadata
  const metadata = await sharp(phoneFrameImage).metadata();
  console.log(`Original image: ${metadata.width}x${metadata.height}`);

  // The phone frame takes up space around the actual screen content
  // Need to crop inside the bezel to get just the screen
  // Looking at 1024x1536 image, the screen area is roughly:
  // - Left edge of screen: ~12% from left
  // - Right edge: ~88% from left
  // - Top of screen (below notch area): ~5% from top
  // - Bottom of screen: ~94% from top

  const screenCrop = {
    left: Math.floor(metadata.width * 0.155),   // 15.5% from left
    top: Math.floor(metadata.height * 0.058),   // 5.8% from top
    width: Math.floor(metadata.width * 0.68),   // 68% width (pure screen)
    height: Math.floor(metadata.height * 0.80)  // 80% height (pure screen)
  };

  console.log(`Cropping: left=${screenCrop.left}, top=${screenCrop.top}, width=${screenCrop.width}, height=${screenCrop.height}`);

  const croppedScreenPath = path.join(path.dirname(phoneFrameImage), 'okapiFindScreen-content-only.png');

  await sharp(phoneFrameImage)
    .extract(screenCrop)
    .toFile(croppedScreenPath);

  const croppedMeta = await sharp(croppedScreenPath).metadata();
  console.log(`Cropped screen content: ${croppedMeta.width}x${croppedMeta.height} -> ${croppedScreenPath}`);
}

main().catch(console.error);
