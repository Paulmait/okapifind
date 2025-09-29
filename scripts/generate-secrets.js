#!/usr/bin/env node

/**
 * Secret Generation Script
 * Generates all required cryptographic keys and secrets for OkapiFind
 * Run: node scripts/generate-secrets.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('🔐 Generating Fort Knox Security Secrets...\n');

// Function to generate secure random strings
function generateSecret(length = 32, encoding = 'base64') {
  return crypto.randomBytes(length).toString(encoding);
}

// Function to generate JWT secret
function generateJWTSecret() {
  return crypto.randomBytes(64).toString('base64');
}

// Function to generate API key
function generateAPIKey() {
  const prefix = 'sk_live_';
  const key = crypto.randomBytes(32).toString('hex');
  return prefix + key;
}

// Function to generate database password
function generateDatabasePassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=';
  let password = '';
  for (let i = 0; i < 32; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Function to generate TOTP secret
function generateTOTPSecret() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  for (let i = 0; i < 32; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return secret;
}

// Generate all secrets
const secrets = {
  // Core Security
  MASTER_ENCRYPTION_KEY: generateSecret(64, 'base64'),
  ENCRYPTION_SALT: generateSecret(32, 'hex'),
  JWT_SECRET: generateJWTSecret(),
  JWT_REFRESH_SECRET: generateJWTSecret(),
  SESSION_SECRET: generateSecret(64, 'base64'),
  CSRF_SECRET: generateSecret(32, 'hex'),
  API_KEY_SALT: generateSecret(32, 'hex'),
  AUDIT_ENCRYPTION_KEY: generateSecret(64, 'base64'),

  // 2FA Secrets
  TOTP_SECRET_KEY: generateTOTPSecret(),
  SMS_ENCRYPTION_KEY: generateSecret(32, 'base64'),
  BACKUP_CODES_KEY: generateSecret(32, 'base64'),

  // Database
  DATABASE_PASSWORD: generateDatabasePassword(),
  REDIS_PASSWORD: generateSecret(32, 'hex'),
  REDIS_CLUSTER_PASSWORD: generateSecret(32, 'hex'),

  // Admin
  SUPER_ADMIN_TOKEN: generateSecret(64, 'base64'),
  ADMIN_2FA_SECRET: generateTOTPSecret(),

  // API Keys (examples - replace with actual)
  STRIPE_SECRET_KEY: generateAPIKey(),
  STRIPE_WEBHOOK_SECRET: 'whsec_' + generateSecret(32, 'hex'),
  RESEND_API_KEY: 're_' + generateSecret(32, 'hex'),
  RESEND_WEBHOOK_SECRET: 'whsec_' + generateSecret(32, 'hex'),

  // Webhook Secrets
  GITHUB_WEBHOOK_SECRET: generateSecret(32, 'hex'),
  VERCEL_WEBHOOK_SECRET: generateSecret(32, 'hex'),

  // Supabase (generate actual values from Supabase dashboard)
  SUPABASE_JWT_SECRET: generateJWTSecret(),
  SUPABASE_ANON_KEY: 'eyJ' + generateSecret(200, 'base64url'),
  SUPABASE_SERVICE_KEY: 'eyJ' + generateSecret(200, 'base64url'),
};

// Generate RSA key pair for additional security
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 4096,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem',
    cipher: 'aes-256-cbc',
    passphrase: secrets.MASTER_ENCRYPTION_KEY
  }
});

// Output the secrets
console.log('=' .repeat(60));
console.log('GENERATED SECRETS - SAVE THESE SECURELY!');
console.log('=' .repeat(60));
console.log('\n');

Object.entries(secrets).forEach(([key, value]) => {
  console.log(`${key}=${value}`);
});

console.log('\n# RSA PUBLIC KEY');
console.log('RSA_PUBLIC_KEY="' + publicKey.replace(/\n/g, '\\n') + '"');

console.log('\n# RSA PRIVATE KEY (Encrypted)');
console.log('RSA_PRIVATE_KEY="' + privateKey.replace(/\n/g, '\\n') + '"');

// Generate .env.local file
const envContent = Object.entries(secrets)
  .map(([key, value]) => `${key}=${value}`)
  .join('\n');

const envPath = path.join(process.cwd(), '.env.secrets');
fs.writeFileSync(envPath, envContent + '\n\n# RSA Keys\n' +
  'RSA_PUBLIC_KEY="' + publicKey.replace(/\n/g, '\\n') + '"\n' +
  'RSA_PRIVATE_KEY="' + privateKey.replace(/\n/g, '\\n') + '"\n');

console.log('\n');
console.log('=' .repeat(60));
console.log('✅ Secrets generated successfully!');
console.log('📁 Saved to: .env.secrets');
console.log('⚠️  IMPORTANT: Add these to Vercel Environment Variables');
console.log('🔒 Keep these secrets secure and never commit to Git!');
console.log('=' .repeat(60));

// Generate Supabase specific values
console.log('\n');
console.log('=' .repeat(60));
console.log('SUPABASE CONFIGURATION');
console.log('=' .repeat(60));
console.log('\nRun these commands in Supabase SQL Editor:\n');

const supabaseSQL = `
-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create secure functions
CREATE OR REPLACE FUNCTION generate_uid()
RETURNS text AS $$
BEGIN
  RETURN gen_random_uuid()::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create JWT secret (use the generated one)
ALTER DATABASE postgres SET "app.jwt_secret" TO '${secrets.SUPABASE_JWT_SECRET}';

-- Create encryption extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Function to encrypt sensitive data
CREATE OR REPLACE FUNCTION encrypt_text(plain_text text)
RETURNS text AS $$
BEGIN
  RETURN pgp_sym_encrypt(plain_text, current_setting('app.jwt_secret'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrypt sensitive data
CREATE OR REPLACE FUNCTION decrypt_text(encrypted_text text)
RETURNS text AS $$
BEGIN
  RETURN pgp_sym_decrypt(encrypted_text::bytea, current_setting('app.jwt_secret'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

console.log(supabaseSQL);

// Generate backup scripts
const backupScript = `#!/bin/bash
# Automated Backup Script for OkapiFind

# Configuration
export PGPASSWORD="${secrets.DATABASE_PASSWORD}"
DATABASE_URL="postgresql://postgres:${secrets.DATABASE_PASSWORD}@db.supabase.co:5432/postgres"
BACKUP_DIR="/backups"
S3_BUCKET="okapifind-backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup
pg_dump $DATABASE_URL --format=custom --verbose --no-owner > $BACKUP_DIR/backup_$DATE.sql

# Encrypt backup
openssl enc -aes-256-cbc -salt -in $BACKUP_DIR/backup_$DATE.sql -out $BACKUP_DIR/backup_$DATE.sql.enc -pass pass:${secrets.MASTER_ENCRYPTION_KEY}

# Upload to S3
aws s3 cp $BACKUP_DIR/backup_$DATE.sql.enc s3://$S3_BUCKET/backups/backup_$DATE.sql.enc

# Clean old local backups (keep last 7 days)
find $BACKUP_DIR -name "*.sql*" -mtime +7 -delete

echo "Backup completed: backup_$DATE.sql.enc"
`;

fs.writeFileSync('scripts/backup.sh', backupScript);

console.log('\n✅ Generated backup.sh script');

// Generate key rotation script
const keyRotationScript = `#!/usr/bin/env node
// Key Rotation Script - Run monthly

const crypto = require('crypto');
const fs = require('fs');

console.log('🔄 Rotating encryption keys...');

const newKeys = {
  MASTER_ENCRYPTION_KEY: crypto.randomBytes(64).toString('base64'),
  JWT_SECRET: crypto.randomBytes(64).toString('base64'),
  SESSION_SECRET: crypto.randomBytes(64).toString('base64'),
  ROTATION_DATE: new Date().toISOString()
};

// Save new keys
fs.writeFileSync('.env.rotated', Object.entries(newKeys)
  .map(([k, v]) => \`\${k}=\${v}\`)
  .join('\\n'));

console.log('✅ Keys rotated successfully');
console.log('📁 New keys saved to .env.rotated');
console.log('⚠️  Update Vercel environment variables immediately!');
`;

fs.writeFileSync('scripts/rotate-keys.js', keyRotationScript);

console.log('✅ Generated rotate-keys.js script');
console.log('\n🎉 All security scripts generated successfully!');