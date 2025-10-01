const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const path = require('path');
const webpack = require('webpack');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(
    {
      ...env,
      // Performance optimizations
      babel: {
        dangerouslyAddModulePathsToTranspile: [
          'react-native-maps',
          'react-native-skeleton-placeholder',
          '@react-navigation/elements',
          '@react-navigation/native',
          '@react-navigation/stack',
          'react-native-gesture-handler',
          'react-native-safe-area-context',
          'react-native-screens',
        ],
      },
    },
    argv
  );

  // Inject environment variables at build time
  config.plugins.push(
    new webpack.DefinePlugin({
      'process.env.EXPO_PUBLIC_FIREBASE_API_KEY': JSON.stringify(process.env.EXPO_PUBLIC_FIREBASE_API_KEY),
      'process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN': JSON.stringify(process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN),
      'process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID': JSON.stringify(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID),
      'process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET': JSON.stringify(process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET),
      'process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
      'process.env.EXPO_PUBLIC_FIREBASE_APP_ID': JSON.stringify(process.env.EXPO_PUBLIC_FIREBASE_APP_ID),
      'process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID': JSON.stringify(process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID),
      'process.env.EXPO_PUBLIC_SUPABASE_URL': JSON.stringify(process.env.EXPO_PUBLIC_SUPABASE_URL),
      'process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
      'process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN': JSON.stringify(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN),
      'process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY': JSON.stringify(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY),
      'process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID': JSON.stringify(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID),
      'process.env.EXPO_PUBLIC_SENTRY_DSN': JSON.stringify(process.env.EXPO_PUBLIC_SENTRY_DSN),
      'process.env.EXPO_PUBLIC_GEMINI_API_KEY': JSON.stringify(process.env.EXPO_PUBLIC_GEMINI_API_KEY),
      'process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS': JSON.stringify(process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS),
      'process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID': JSON.stringify(process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID),
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
    })
  );

  // Configure resolve fallbacks for Node.js modules
  config.resolve = config.resolve || {};
  config.resolve.fallback = {
    ...config.resolve.fallback,
    fs: false,
    path: false,
    crypto: false,
    stream: false,
    buffer: false,
    util: false,
    process: false,
    child_process: false,
    zlib: false,
    'node-cron': false,
    'aws-sdk': false,
    ioredis: false,
  };

  // Ignore Node.js-only modules
  const existingExternals = Array.isArray(config.externals) ? config.externals : [];
  config.externals = [
    ...existingExternals,
    {
      'child_process': 'commonjs child_process',
      'node-cron': 'commonjs node-cron',
    },
  ];

  // Use custom HTML template
  const HtmlWebpackPlugin = config.plugins.find(
    plugin => plugin.constructor.name === 'HtmlWebpackPlugin'
  );
  if (HtmlWebpackPlugin) {
    HtmlWebpackPlugin.userOptions.template = path.resolve(__dirname, 'web/index.html');
  }

  // Fix: Ensure react-navigation is transpiled properly
  // Find and modify babel-loader rule to include problematic node_modules
  config.module.rules.forEach(rule => {
    if (rule.oneOf) {
      rule.oneOf.forEach(oneOfRule => {
        if (oneOfRule.loader && oneOfRule.loader.includes('babel-loader')) {
          // Modify the exclude to not exclude react-navigation
          if (oneOfRule.exclude) {
            oneOfRule.exclude = /node_modules\/(?!(@react-navigation|react-native-gesture-handler|react-native-safe-area-context|react-native-screens))/;
          }
        }
      });
    }
  });

  // Customize the config for production
  if (config.mode === 'production') {
    // Optimize for production with code splitting
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: 10,
          },
          common: {
            minChunks: 2,
            priority: 5,
            reuseExistingChunk: true,
          },
        },
      },
    };

    // Add service worker for PWA if workbox is available
    try {
      const { GenerateSW } = require('workbox-webpack-plugin');
      config.plugins.push(
        new GenerateSW({
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-stylesheets',
              },
            },
            {
              urlPattern: /^https:\/\/api\.mapbox\.com/,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'mapbox-api',
              },
            },
          ],
        })
      );
    } catch (error) {
      console.warn('Workbox plugin not available, PWA service worker will not be generated');
    }
  }

  return config;
};