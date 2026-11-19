/**
 * Global Jest setup (wired in jest.config.js's setupFiles) — refuses to let
 * ANY test file run unless DATABASE_URL and APP_DATABASE_URL point at a
 * local/disposable database. Added after test/rls/tenant-isolation.spec.ts's
 * own `beforeEach` (a raw `TRUNCATE ... CASCADE`) wiped the live database's
 * roles/users/companies tables — twice now, across two separate sessions.
 *
 * This guard is an ALLOWLIST, deliberately. It used to be a denylist that
 * matched one hostname pattern (`supabase.co`), which stopped protecting
 * anything the moment production moved off Supabase onto Railway Postgres —
 * a `*.proxy.rlwy.net` URL matched nothing and ran straight through. Any
 * denylist has that failure mode on the next migration; an allowlist fails
 * closed instead, so a host nobody anticipated is refused rather than
 * truncated.
 *
 * That file (and every other test file that connects directly to a
 * database — every file under test/contract/, test/unit/token-rotation/,
 * and test/rls/) was built against the real hosted project rather than
 * an isolated local one; this guard doesn't fix that gap, it just stops
 * the specific failure mode (an accidental real-DB wipe) from recurring
 * while that gap remains open. Real test-database isolation (a local
 * Postgres container, a throwaway project, etc.) is a follow-up decision,
 * not something this guard can substitute for.
 */

// Hostnames that cannot be a shared/production database: loopback, plus the
// service names a local docker-compose Postgres is conventionally reachable
// at. Anything else — including every managed-Postgres hostname — is refused.
const ALLOWED_TEST_DB_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '[::1]',
  '0.0.0.0',
  'host.docker.internal',
  'postgres',
  'db',
]);

function hostnameOf(varName: string, value: string): string {
  try {
    // `new URL` keeps IPv6 literals bracketed, which ALLOWED_TEST_DB_HOSTS
    // accounts for; it also strips credentials, so nothing secret is ever
    // interpolated into the error messages below.
    return new URL(value).hostname;
  } catch {
    throw new Error(
      `Refusing to run tests: ${varName} is not a parseable database URL, so this guard cannot ` +
        'verify it points at a disposable database. Fix the URL, or unset it if these tests do not need it.',
    );
  }
}

function assertNotProductionDatabase(varName: string): void {
  const value = process.env[varName];
  if (!value) {
    return;
  }

  const hostname = hostnameOf(varName, value);
  if (!ALLOWED_TEST_DB_HOSTS.has(hostname.toLowerCase())) {
    throw new Error(
      `Refusing to run tests: ${varName} points at host "${hostname}", which is not a recognised ` +
        'local/disposable database. This test suite includes files that TRUNCATE tables directly — running it ' +
        'against a real database will destroy real data (this has already happened twice). Point ' +
        'DATABASE_URL/APP_DATABASE_URL at a local test database before running tests. If this host genuinely ' +
        'is disposable, add it to ALLOWED_TEST_DB_HOSTS in this file rather than weakening the check.',
    );
  }
}

assertNotProductionDatabase('DATABASE_URL');
assertNotProductionDatabase('APP_DATABASE_URL');
