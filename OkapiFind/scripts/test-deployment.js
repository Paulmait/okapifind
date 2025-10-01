#!/usr/bin/env node

/**
 * Test script to verify Vercel deployment is working correctly
 * Run: node scripts/test-deployment.js https://okapifind.com
 */

const https = require('https');
const http = require('http');

const DEPLOYMENT_URL = process.argv[2] || 'https://okapifind.com';

const TESTS = [
  {
    name: 'Homepage loads',
    test: async (html) => html.includes('<title>'),
  },
  {
    name: 'React app mounts',
    test: async (html) => html.includes('id="root"') || html.includes('id="app"'),
  },
  {
    name: 'No require() error in vendors bundle',
    test: async (html) => {
      const match = html.match(/static\/js\/vendors\.[a-f0-9]+\.js/);
      if (!match) return { pass: false, reason: 'vendors bundle not found' };

      const bundleUrl = `${DEPLOYMENT_URL}/${match[0]}`;
      const bundleContent = await fetchUrl(bundleUrl);

      // Check if the patched version exists (using import)
      const hasImport = bundleContent.includes('import') || bundleContent.includes('from "react-native-safe-area-context"');
      const hasRequire = bundleContent.includes('require("react-native-safe-area-context")') ||
                        bundleContent.includes("require('react-native-safe-area-context')");

      if (hasRequire && !hasImport) {
        return { pass: false, reason: 'vendors bundle still uses require() - patch not applied' };
      }

      return { pass: true, reason: 'vendors bundle looks good' };
    },
  },
  {
    name: 'Environment variables injected',
    test: async (html) => {
      const match = html.match(/static\/js\/main\.[a-f0-9]+\.js/);
      if (!match) return { pass: false, reason: 'main bundle not found' };

      const bundleUrl = `${DEPLOYMENT_URL}/${match[0]}`;
      const bundleContent = await fetchUrl(bundleUrl);

      // Check if Firebase API key is present (not undefined)
      const hasFirebaseKey = !bundleContent.includes('FIREBASE_API_KEY:void 0') &&
                            !bundleContent.includes('FIREBASE_API_KEY:undefined');

      if (!hasFirebaseKey) {
        return { pass: false, reason: 'Firebase API key not injected (shows as undefined)' };
      }

      return { pass: true, reason: 'Environment variables appear to be injected' };
    },
  },
  {
    name: 'Service worker exists',
    test: async (html) => {
      const swUrl = `${DEPLOYMENT_URL}/service-worker.js`;
      try {
        await fetchUrl(swUrl);
        return { pass: true };
      } catch (e) {
        return { pass: false, reason: 'service-worker.js not found (this is okay for now)' };
      }
    },
  },
  {
    name: 'Static assets load',
    test: async (html) => {
      const hasStaticJS = html.includes('/static/js/');
      const hasStaticCSS = html.includes('/static/css/') || !html.includes('.css'); // CSS is optional
      return { pass: hasStaticJS, reason: hasStaticJS ? 'Static assets found' : 'No static JS found' };
    },
  },
];

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;

    client.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('🧪 Testing OkapiFind Deployment\n');
  console.log('URL:', DEPLOYMENT_URL);
  console.log('=' .repeat(70));
  console.log();

  try {
    console.log('📥 Fetching homepage...');
    const html = await fetchUrl(DEPLOYMENT_URL);
    console.log('✅ Homepage fetched successfully\n');

    let passedTests = 0;
    let failedTests = 0;

    for (const test of TESTS) {
      process.stdout.write(`Testing: ${test.name}... `);

      try {
        const result = await test.test(html);
        const passed = typeof result === 'boolean' ? result : result.pass;
        const reason = typeof result === 'object' ? result.reason : '';

        if (passed) {
          console.log('✅ PASS', reason ? `(${reason})` : '');
          passedTests++;
        } else {
          console.log('❌ FAIL', reason ? `- ${reason}` : '');
          failedTests++;
        }
      } catch (err) {
        console.log('❌ ERROR -', err.message);
        failedTests++;
      }
    }

    console.log();
    console.log('=' .repeat(70));
    console.log(`\n📊 Results: ${passedTests}/${TESTS.length} tests passed\n`);

    if (failedTests === 0) {
      console.log('🎉 All tests passed! Your deployment is working correctly.\n');
      process.exit(0);
    } else {
      console.log(`⚠️  ${failedTests} test(s) failed. Check the issues above.\n`);
      process.exit(1);
    }

  } catch (err) {
    console.error('\n❌ Failed to fetch deployment:', err.message);
    console.error('\nPossible reasons:');
    console.error('  - Deployment is not live yet');
    console.error('  - URL is incorrect');
    console.error('  - Network issue\n');
    process.exit(1);
  }
}

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                  OkapiFind Deployment Test                    ║
╚═══════════════════════════════════════════════════════════════╝
`);

runTests();
