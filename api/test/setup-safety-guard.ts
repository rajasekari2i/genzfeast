/**
 * Global Jest setup (wired in jest.config.js's setupFiles) — refuses to let
 * ANY test file run if DATABASE_URL or APP_DATABASE_URL points at a real
 * Supabase project. Added after test/rls/tenant-isolation.spec.ts's own
 * `beforeEach` (a raw `TRUNCATE ... CASCADE`) wiped the live database's
 * roles/users/companies tables — twice now, across two separate sessions.
 *
 * That file (and every other test file that connects directly to a
 * database — every file under test/contract/, test/unit/token-rotation/,
 * and test/rls/) was built against the real Supabase project rather than
 * an isolated local/disposable one; this guard doesn't fix that gap, it
 * just stops the specific failure mode (an accidental real-DB wipe) from
 * recurring while that gap remains open. Real test-database isolation
 * (a local Postgres container, a separate throwaway Supabase project,
 * etc.) is a follow-up decision, not something this guard can substitute
 * for.
 */
const SUPABASE_HOST_PATTERN = /supabase\.co/i;

function assertNotProductionDatabase(varName: string): void {
  const value = process.env[varName];
  if (value && SUPABASE_HOST_PATTERN.test(value)) {
    throw new Error(
      `Refusing to run tests: ${varName} points at a Supabase-hosted database (matched "${SUPABASE_HOST_PATTERN}"). ` +
        'This test suite includes files that TRUNCATE tables directly — running it against a real Supabase project ' +
        'will destroy real data (this has already happened twice). Point DATABASE_URL/APP_DATABASE_URL at a local ' +
        'or otherwise disposable test database before running tests.',
    );
  }
}

assertNotProductionDatabase('DATABASE_URL');
assertNotProductionDatabase('APP_DATABASE_URL');
