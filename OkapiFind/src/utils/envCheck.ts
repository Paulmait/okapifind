/**
 * Environment Variables Checker
 * Validates that all required environment variables are present
 */

export interface EnvCheckResult {
  isValid: boolean;
  missing: string[];
  present: string[];
  warnings: string[];
}

const REQUIRED_ENV_VARS = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
];

const OPTIONAL_ENV_VARS = [
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID',
  'EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN',
  'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY',
  'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
  'EXPO_PUBLIC_SENTRY_DSN',
  'EXPO_PUBLIC_GEMINI_API_KEY',
  'EXPO_PUBLIC_REVENUECAT_API_KEY_IOS',
  'EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID',
];

/**
 * Check if all required environment variables are present
 */
export function checkEnvironmentVariables(): EnvCheckResult {
  const missing: string[] = [];
  const present: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  REQUIRED_ENV_VARS.forEach((varName) => {
    const value = process.env[varName];
    if (!value || value === 'undefined' || value === 'null') {
      missing.push(varName);
    } else {
      present.push(varName);
    }
  });

  // Check optional variables (just warnings)
  OPTIONAL_ENV_VARS.forEach((varName) => {
    const value = process.env[varName];
    if (!value || value === 'undefined' || value === 'null') {
      warnings.push(`Optional: ${varName} is not set`);
    } else {
      present.push(varName);
    }
  });

  return {
    isValid: missing.length === 0,
    missing,
    present,
    warnings,
  };
}

/**
 * Log environment check results to console
 */
export function logEnvironmentCheck(): EnvCheckResult {
  const result = checkEnvironmentVariables();

  console.log('🔍 Environment Variables Check:');
  console.log('================================');

  if (result.isValid) {
    console.log('✅ All required environment variables are present');
    console.log(`📊 Total variables configured: ${result.present.length}`);
  } else {
    console.error('❌ Missing required environment variables:');
    result.missing.forEach((varName) => {
      console.error(`   - ${varName}`);
    });
  }

  if (result.warnings.length > 0) {
    console.warn('⚠️  Optional variables not set:');
    result.warnings.forEach((warning) => {
      console.warn(`   - ${warning}`);
    });
  }

  // Log present variables (without values for security)
  if (result.present.length > 0) {
    console.log('✓ Present variables:');
    result.present.forEach((varName) => {
      const value = process.env[varName];
      const preview = value ? `${value.substring(0, 10)}...` : 'empty';
      console.log(`   - ${varName}: ${preview}`);
    });
  }

  console.log('================================');

  return result;
}

/**
 * Get a safe display string for debugging
 */
export function getEnvironmentSummary(): string {
  const result = checkEnvironmentVariables();

  return `
Environment Status: ${result.isValid ? '✅ Valid' : '❌ Invalid'}
Required Variables: ${REQUIRED_ENV_VARS.length - result.missing.length}/${REQUIRED_ENV_VARS.length}
Optional Variables: ${result.present.length - (REQUIRED_ENV_VARS.length - result.missing.length)}/${OPTIONAL_ENV_VARS.length}
${result.missing.length > 0 ? `\nMissing: ${result.missing.join(', ')}` : ''}
  `.trim();
}

export default {
  check: checkEnvironmentVariables,
  log: logEnvironmentCheck,
  summary: getEnvironmentSummary,
};
