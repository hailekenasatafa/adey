// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
    rules: {
      // Stylistic only; apostrophes in copy are intentional.
      'react/no-unescaped-entities': 'off',
    },
  },
]);
