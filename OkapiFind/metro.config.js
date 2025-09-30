const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add support for additional file extensions
config.resolver.sourceExts.push('cjs', 'mjs');

// Configure asset extensions
config.resolver.assetExts.push(
  // Fonts
  'ttf',
  'otf',
  'woff',
  'woff2',
  // Images
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  // Audio/Video
  'mp3',
  'mp4',
  'mov',
  // Other
  'db',
  'json'
);

// Increase max workers for better performance (optional)
config.maxWorkers = 4;

// Configure watchman (file watcher) settings
config.watchFolders = [__dirname];

// Enable hermetic builds for better caching
config.resetCache = false;

module.exports = config;