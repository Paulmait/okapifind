const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(
    {
      ...env,
      // Performance optimizations
      babel: {
        dangerouslyAddModulePathsToTranspile: [
          'react-native-maps',
          'react-native-skeleton-placeholder',
        ],
      },
      // PWA configuration
      offline: true,
    },
    argv
  );

  // Customize the config
  if (config.mode === 'production') {
    // Optimize for production
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
  }

  // Add service worker for PWA
  config.plugins.push(
    new (require('workbox-webpack-plugin').GenerateSW)({
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

  return config;
};