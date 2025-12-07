module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['./jest.setup.js'],
  testMatch: ['**/__tests__/**/*.{test,spec}.{ts,tsx,js,jsx}', '**/__tests__/**/*-test.{ts,tsx,js,jsx}'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverageFrom: [
    'services/**/*.{ts,tsx}',
    '!services/**/*.d.ts',
    '!**/node_modules/**',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)',
  ],
};

