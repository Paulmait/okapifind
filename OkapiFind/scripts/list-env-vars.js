#!/usr/bin/env node

/**
 * This script lists all EXPO_PUBLIC_* environment variables that need to be set in Vercel
 * Run: node scripts/list-env-vars.js
 */

const fs = require('fs');
const path = require('path');

// Required variables for the app to work
const REQUIRED_VARS = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
  'EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID',
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN',
  'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
];

const OPTIONAL_VARS = [
  'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY',
  'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
  'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID',
  'EXPO_PUBLIC_REVENUECAT_API_KEY_IOS',
  'EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID',
  'EXPO_PUBLIC_GEMINI_API_KEY',
  'EXPO_PUBLIC_SENTRY_DSN',
];

function maskValue(value) {
  if (!value || value.length < 10) return '***';
  return value.substring(0, 8) + '...' + value.substring(value.length - 4);
}

function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');

  if (!fs.existsSync(envPath)) {
    console.error('❌ .env file not found at:', envPath);
    console.log('\nCreate a .env file by copying .env.example:');
    console.log('  cp .env.example .env');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};

  envContent.split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;

    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      envVars[key.trim()] = value.trim();
    }
  });

  return envVars;
}

function main() {
  console.log('🔍 OkapiFind - Vercel Environment Variables Setup\n');
  console.log('=' .repeat(70));
  console.log('\n📋 Loading variables from .env file...\n');

  const envVars = loadEnvFile();

  console.log('✅ Required Variables (MUST be set in Vercel):\n');

  const missingRequired = [];
  const presentRequired = [];

  REQUIRED_VARS.forEach(varName => {
    const value = envVars[varName];
    if (value) {
      presentRequired.push(varName);
      console.log(`  ✓ ${varName}`);
      console.log(`    Value: ${maskValue(value)}`);
      console.log(`    Length: ${value.length} characters\n`);
    } else {
      missingRequired.push(varName);
      console.log(`  ✗ ${varName} - NOT SET ❌\n`);
    }
  });

  console.log('\n' + '='.repeat(70));
  console.log('\n⚠️  Optional Variables (app will work without these):\n');

  const missingOptional = [];
  const presentOptional = [];

  OPTIONAL_VARS.forEach(varName => {
    const value = envVars[varName];
    if (value) {
      presentOptional.push(varName);
      console.log(`  ✓ ${varName}`);
      console.log(`    Value: ${maskValue(value)}\n`);
    } else {
      missingOptional.push(varName);
      console.log(`  ○ ${varName} - Not set\n`);
    }
  });

  console.log('\n' + '='.repeat(70));
  console.log('\n📊 Summary:\n');
  console.log(`  Required: ${presentRequired.length}/${REQUIRED_VARS.length} set`);
  console.log(`  Optional: ${presentOptional.length}/${OPTIONAL_VARS.length} set`);
  console.log(`  Total to add to Vercel: ${presentRequired.length + presentOptional.length}\n`);

  if (missingRequired.length > 0) {
    console.log('⚠️  WARNING: Missing required variables!\n');
    console.log('These variables are MISSING from your .env file:');
    missingRequired.forEach(v => console.log(`  - ${v}`));
    console.log('\nThe app will NOT work without these variables.\n');
  }

  console.log('=' .repeat(70));
  console.log('\n📝 Next Steps:\n');
  console.log('1. Go to: https://vercel.com/dashboard');
  console.log('2. Select your project');
  console.log('3. Go to: Settings → Environment Variables');
  console.log('4. For EACH variable listed above with ✓:');
  console.log('   - Click "Add New"');
  console.log('   - Name: Copy the variable name exactly');
  console.log('   - Value: Copy from your .env file (NOT the masked value)');
  console.log('   - Environments: Check ALL three: Production, Preview, Development');
  console.log('   - Click "Save"');
  console.log('5. After adding ALL variables:');
  console.log('   - Go to Deployments tab');
  console.log('   - Click "..." on latest deployment');
  console.log('   - Click "Redeploy"');
  console.log('   - UNCHECK "Use existing build cache"');
  console.log('   - Click "Redeploy"');
  console.log('\n' + '='.repeat(70));

  if (missingRequired.length === 0) {
    console.log('\n✅ All required variables are present in .env!');
    console.log('   Now add them to Vercel dashboard.\n');
  } else {
    console.log('\n❌ Fix your .env file first before adding to Vercel!\n');
    process.exit(1);
  }
}

main();
