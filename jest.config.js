/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  // Crypto deps ship ESM — let babel transform them (default jest-expo ignores node_modules).
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@noble/.*|@scure/.*|micro-packed|boltz-core|nostr-tools|@cashu/.*|@getalby/.*))',
  ],
};
