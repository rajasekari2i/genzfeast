/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  setupFiles: ['dotenv/config'],
  // The RLS suite under test/rls/ makes several sequential round-trips per
  // test against a real Postgres instance (local container or, as of this
  // work unit, a live Supabase project) — Jest's 5000ms default is too
  // tight for that over a real network. 30s gives ample headroom without
  // masking a genuinely hung test.
  testTimeout: 30000,
};
