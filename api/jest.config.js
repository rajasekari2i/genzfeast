/** @type {import('jest').Config} */
module.exports = {
  // Top-level only — Jest doesn't accept testTimeout inside a project
  // entry. Applies to both projects; harmless for "unit" (its tests are
  // fast and pass well within 5s anyway), and gives "integration" the
  // headroom its real network round-trips need.
  testTimeout: 30000,
  projects: [
    {
      // Fully mocked — zero database access, enforced structurally by
      // test/unit/setup-no-prisma.ts (not just "please don't import
      // PrismaClient here"), not just by directory convention. This is
      // the project `npm run test:unit` runs, and the only one coverage
      // should be computed from for a genuine unit-test number.
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'node',
      rootDir: '.',
      testMatch: ['<rootDir>/test/unit/**/*.spec.ts'],
      setupFiles: ['<rootDir>/test/unit/setup-no-prisma.ts'],
    },
    {
      // Integration/contract/RLS tests — genuinely need a real (but never
      // production) Postgres database. setup-safety-guard.ts refuses to
      // run any of these if DATABASE_URL/APP_DATABASE_URL points at a
      // Supabase-hosted project (see its own header for why).
      displayName: 'integration',
      preset: 'ts-jest',
      testEnvironment: 'node',
      rootDir: '.',
      testMatch: ['<rootDir>/test/contract/**/*.spec.ts', '<rootDir>/test/rls/**/*.spec.ts'],
      // Order matters: dotenv must load .env before the safety guard reads
      // DATABASE_URL/APP_DATABASE_URL from it.
      setupFiles: ['dotenv/config', '<rootDir>/test/setup-safety-guard.ts'],
    },
  ],
};
