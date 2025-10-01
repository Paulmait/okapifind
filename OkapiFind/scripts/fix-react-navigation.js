#!/usr/bin/env node

/**
 * Direct fix for @react-navigation/elements useFrameSize.tsx
 * Converts require() to import statement for browser compatibility
 */

const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(
  __dirname,
  '..',
  'node_modules',
  '@react-navigation',
  'elements',
  'lib',
  'module',
  'useFrameSize.js'
);

console.log('🔧 Fixing @react-navigation/elements for web...');
console.log('   File:', FILE_PATH);

if (!fs.existsSync(FILE_PATH)) {
  console.error('❌ File not found:', FILE_PATH);
  process.exit(1);
}

try {
  let content = fs.readFileSync(FILE_PATH, 'utf8');

  // Check if already fixed
  if (!content.includes('require("react-native-safe-area-context")') &&
      !content.includes("require('react-native-safe-area-context')")) {
    console.log('✅ File already fixed!');
    process.exit(0);
  }

  // Fix the require() to import
  const originalContent = content;

  // Replace the require pattern with import
  content = content.replace(
    /const SafeAreaListener = require\(['"]react-native-safe-area-context['"]\)\.SafeAreaListener/g,
    'import { SafeAreaListener } from "react-native-safe-area-context";\nconst _unused = SafeAreaListener'
  );

  content = content.replace(
    /require\(['"]react-native-safe-area-context['"]\)\.SafeAreaListener/g,
    '(() => { const { SafeAreaListener } = require("react-native-safe-area-context"); return SafeAreaListener; })()'
  );

  if (content === originalContent) {
    console.warn('⚠️  Could not find pattern to replace');
    console.log('   Looking for different pattern...');

    // Try more aggressive replacement
    content = content.replace(
      /require\(['"](react-native-safe-area-context)['"]\)/g,
      'await import("$1").then(m => m)'
    );
  }

  if (content !== originalContent) {
    fs.writeFileSync(FILE_PATH, content, 'utf8');
    console.log('✅ Fixed successfully!');
    process.exit(0);
  } else {
    console.error('❌ Pattern not found in file');
    console.log('\nFile content preview:');
    console.log(content.substring(0, 500));
    process.exit(1);
  }
} catch (err) {
  console.error('❌ Error:', err.message);
  process.exit(1);
}
