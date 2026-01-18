const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'assets', 'app-store', 'ios');

async function main() {
  console.log('=== App Store Asset Verification & Setup ===\n');

  // 1. Copy cropped promotional image to assets
  console.log('1. Adding promotional image to assets...');
  const promoDir = path.join(assetsDir, 'promotional');
  if (!fs.existsSync(promoDir)) {
    fs.mkdirSync(promoDir, { recursive: true });
  }

  const sourcePromo = 'C:\\Users\\maito\\Downloads\\okapiFindScreen-content-only.png';
  const destPromo = path.join(promoDir, 'promo-screen-content.png');
  fs.copyFileSync(sourcePromo, destPromo);
  console.log(`Copied: ${destPromo}`);

  // 2. Verify all required screenshot sizes
  console.log('\n2. Verifying screenshot sizes...\n');

  const requiredSizes = {
    '6.7-inch': { width: 1290, height: 2796, desc: 'iPhone 14/15 Pro Max' },
    '6.5-inch': { width: 1242, height: 2688, desc: 'iPhone 11 Pro Max, XS Max' },
    '5.8-inch': { width: 1125, height: 2436, desc: 'iPhone X, XS, 11 Pro' },
    '5.5-inch': { width: 1242, height: 2208, desc: 'iPhone 8/7/6s Plus' },
    'ipad-13': { width: 2048, height: 2732, desc: 'iPad Pro 12.9"' }
  };

  const screenshotsDir = path.join(assetsDir, 'screenshots');

  for (const [folder, expected] of Object.entries(requiredSizes)) {
    const folderPath = path.join(screenshotsDir, folder);
    if (!fs.existsSync(folderPath)) {
      console.log(`❌ MISSING: ${folder}/ folder`);
      continue;
    }

    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.png'));
    console.log(`${folder}/ (${expected.desc}):`);
    console.log(`  Expected: ${expected.width}x${expected.height}`);
    console.log(`  Files: ${files.length}`);

    if (files.length > 0) {
      const sampleFile = path.join(folderPath, files[0]);
      const meta = await sharp(sampleFile).metadata();
      const match = meta.width === expected.width && meta.height === expected.height;
      console.log(`  Actual: ${meta.width}x${meta.height} ${match ? '✅' : '⚠️ SIZE MISMATCH'}`);
    }
    console.log('');
  }

  // 3. Verify subscription image
  console.log('3. Verifying subscription image...');
  const subImage = path.join(assetsDir, 'subscription', 'subscription-promo-1024x1024.png');
  if (fs.existsSync(subImage)) {
    const meta = await sharp(subImage).metadata();
    const match = meta.width === 1024 && meta.height === 1024;
    console.log(`  subscription-promo-1024x1024.png: ${meta.width}x${meta.height} ${match ? '✅' : '⚠️'}`);
  } else {
    console.log('  ❌ MISSING: subscription-promo-1024x1024.png');
  }

  // 4. Check promotional image
  console.log('\n4. Verifying promotional image...');
  const promoMeta = await sharp(destPromo).metadata();
  console.log(`  promo-screen-content.png: ${promoMeta.width}x${promoMeta.height} ✅`);

  console.log('\n=== Summary ===');
  console.log('Assets Location: assets/app-store/ios/');
  console.log('');
  console.log('Folders:');
  console.log('  screenshots/6.7-inch/  - iPhone 14/15 Pro Max');
  console.log('  screenshots/6.5-inch/  - iPhone 11 Pro Max, XS Max');
  console.log('  screenshots/5.8-inch/  - iPhone X, XS, 11 Pro');
  console.log('  screenshots/5.5-inch/  - iPhone 8/7/6s Plus');
  console.log('  screenshots/ipad-13/   - iPad Pro 12.9"');
  console.log('  subscription/          - IAP promotional image (1024x1024)');
  console.log('  promotional/           - Marketing promo image');
  console.log('  icons/                 - App icons all sizes');
}

main().catch(console.error);
