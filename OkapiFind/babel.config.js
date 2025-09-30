module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Enable decorators for TypeGraphQL and other decorator-based libraries
      ['@babel/plugin-proposal-decorators', { legacy: true }],

      // Transform TypeScript types
      '@babel/plugin-transform-flow-strip-types',

      // Reanimated plugin (must be last)
      'react-native-reanimated/plugin',
    ],
    env: {
      production: {
        plugins: [
          // Remove console.log in production
          'transform-remove-console',
        ],
      },
    },
  };
};