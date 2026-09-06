/** @type {import('jest').Config} */
// Scoped to test/theme for now: these are plain-TypeScript unit tests with no
// React Native component under test, so a plain ts-jest setup is sufficient
// and avoids pulling in the heavier jest-expo/react-native mocks this project
// doesn't need yet (spec 013 WU1 — theme core only).
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/test/theme/**/*.spec.ts'],
};
