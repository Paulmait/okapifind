/**
 * Configure Supabase Auth Redirect URLs
 *
 * This script configures the redirect URLs for magic link authentication.
 *
 * Usage:
 *   1. Get your Supabase access token from: https://supabase.com/dashboard/account/tokens
 *   2. Run: SUPABASE_ACCESS_TOKEN=your_token node scripts/configure-supabase-auth.js
 */

const https = require('https');

const PROJECT_REF = 'kmobwbqdtmbzdyysdxjx';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

// Redirect URLs for magic link authentication
const REDIRECT_URLS = [
  'okapifind://auth/callback',           // Production iOS/Android deep link
  'exp://127.0.0.1:8081/--/auth/callback', // Expo Go development
  'exp://192.168.1.*:8081/--/auth/callback', // Expo Go on local network
  'https://okapifind.vercel.app/auth/callback', // Web app
  'https://okapifind.com/auth/callback',  // Production web
];

async function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.supabase.com',
      port: 443,
      path: `/v1/projects/${PROJECT_REF}${path}`,
      method: method,
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function getCurrentConfig() {
  console.log('Fetching current auth configuration...');
  const result = await makeRequest('GET', '/config/auth');

  if (result.status !== 200) {
    console.error('Failed to fetch config:', result.data);
    return null;
  }

  return result.data;
}

async function updateAuthConfig(config) {
  console.log('Updating auth configuration...');

  // Merge new redirect URLs with existing ones
  const existingUrls = config.uri_allow_list || [];
  const allUrls = [...new Set([...existingUrls, ...REDIRECT_URLS])];

  const updateData = {
    ...config,
    uri_allow_list: allUrls,
    // Ensure OTP/Magic Link is enabled
    external_email_enabled: true,
    mailer_otp_enabled: true,
  };

  const result = await makeRequest('PATCH', '/config/auth', updateData);

  if (result.status !== 200) {
    console.error('Failed to update config:', result.data);
    return false;
  }

  return true;
}

async function main() {
  console.log('\n========================================');
  console.log('Supabase Auth Configuration');
  console.log('========================================\n');

  if (!ACCESS_TOKEN) {
    console.log('ERROR: SUPABASE_ACCESS_TOKEN environment variable not set.\n');
    console.log('To get your access token:');
    console.log('1. Go to: https://supabase.com/dashboard/account/tokens');
    console.log('2. Click "Generate new token"');
    console.log('3. Run this script with:');
    console.log('   SUPABASE_ACCESS_TOKEN=your_token node scripts/configure-supabase-auth.js\n');

    console.log('Alternatively, configure manually in the Supabase Dashboard:');
    console.log(`https://supabase.com/dashboard/project/${PROJECT_REF}/auth/url-configuration\n`);
    console.log('Add these redirect URLs:');
    REDIRECT_URLS.forEach(url => console.log(`  - ${url}`));
    console.log('');
    process.exit(1);
  }

  // Get current config
  const currentConfig = await getCurrentConfig();
  if (!currentConfig) {
    console.log('\nFailed to fetch current configuration.');
    console.log('Please configure manually at:');
    console.log(`https://supabase.com/dashboard/project/${PROJECT_REF}/auth/url-configuration\n`);
    process.exit(1);
  }

  console.log('Current redirect URLs:');
  (currentConfig.uri_allow_list || []).forEach(url => console.log(`  - ${url}`));
  console.log('');

  // Update config
  console.log('Adding redirect URLs:');
  REDIRECT_URLS.forEach(url => console.log(`  + ${url}`));
  console.log('');

  const success = await updateAuthConfig(currentConfig);

  if (success) {
    console.log('✅ Auth configuration updated successfully!\n');
    console.log('Magic link authentication is now configured with:');
    console.log(`  - Production deep link: okapifind://auth/callback`);
    console.log(`  - Development: exp://127.0.0.1:8081/--/auth/callback`);
    console.log(`  - Web: https://okapifind.vercel.app/auth/callback\n`);
  } else {
    console.log('❌ Failed to update configuration.\n');
    console.log('Please configure manually at:');
    console.log(`https://supabase.com/dashboard/project/${PROJECT_REF}/auth/url-configuration\n`);
    process.exit(1);
  }
}

main().catch(console.error);
