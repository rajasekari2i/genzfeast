/**
 * specs/012-bootstrap-system-admin-seed. Deployment-time-only script — run
 * once per new environment (not per deploy), never imported by the running
 * application. Guarantees exactly one platform-wide `system_admin` role row
 * and exactly one User referencing it exist, so a freshly deployed
 * environment can log in and start onboarding Companies immediately with no
 * manual database step (FR-001).
 *
 * Connects using the elevated/superuser `DATABASE_URL` credential, never
 * `APP_DATABASE_URL` — no authenticated request context exists yet for
 * RLS's session variables to be set from (research.md §6), exactly like
 * every other schema migration already runs outside that model.
 *
 * Usage (four required env vars, see api/.env.example — never a literal
 * default, per FR-005/research.md §4):
 *   BOOTSTRAP_ADMIN_NAME=... BOOTSTRAP_ADMIN_USERNAME=... \
 *   BOOTSTRAP_ADMIN_EMAIL=... BOOTSTRAP_ADMIN_PASSWORD=... \
 *   DATABASE_URL=... npx ts-node scripts/seed-system-admin.ts
 *
 * Console output is deliberate here (this is a CLI tool's stdout, not
 * application logging — coding_standard.md §8 governs src/**, not
 * scripts/**) — but the raw configured password is never logged, in any
 * branch, at any point (FR-004).
 */
import { PrismaClient } from '@prisma/client';
import { PasswordService } from '../src/auth/password.service';

const REQUIRED_VARS = [
  'BOOTSTRAP_ADMIN_NAME',
  'BOOTSTRAP_ADMIN_USERNAME',
  'BOOTSTRAP_ADMIN_EMAIL',
  'BOOTSTRAP_ADMIN_PASSWORD',
] as const;

function readRequiredEnv(): Record<(typeof REQUIRED_VARS)[number], string> {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(
      `seed-system-admin: missing required environment variable(s): ${missing.join(', ')}. Creating nothing — this script never falls back to a blank, predictable, or hardcoded value.`,
    );
    process.exit(1);
  }
  return Object.fromEntries(REQUIRED_VARS.map((key) => [key, process.env[key] as string])) as Record<
    (typeof REQUIRED_VARS)[number],
    string
  >;
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('seed-system-admin: DATABASE_URL is required (the elevated/migration credential, never APP_DATABASE_URL).');
    process.exit(1);
  }

  const env = readRequiredEnv();
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  const passwordService = new PasswordService();

  try {
    // research.md §1-§2: idempotent, atomic `INSERT ... WHERE NOT EXISTS` —
    // never a blind INSERT, never check-then-insert as two separate
    // round-trips. Roles are global, not per-company (migration
    // 20260907170000) — a plain WHERE NOT EXISTS by name.
    await prisma.$executeRaw`
      INSERT INTO "roles" ("id", "name", "created_at", "updated_at")
      SELECT gen_random_uuid(), 'system_admin', now(), now()
      WHERE NOT EXISTS (
        SELECT 1 FROM "roles" WHERE "name" = 'system_admin'
      );
    `;

    // The "already exists" check is "does any row already reference the
    // system_admin role" — not a check on a specific username, since a
    // future environment might configure a differently-named account
    // (research.md §2). Hashing happens unconditionally before the insert
    // attempt (Argon2id is deterministic-cost but not deterministic-output,
    // so it's cheap to compute even on a no-op run) via `002`'s real
    // PasswordService — never a second hashing implementation.
    const passwordHash = await passwordService.hash(env.BOOTSTRAP_ADMIN_PASSWORD);

    const inserted = await prisma.$executeRaw`
      INSERT INTO "users" (
        "id", "company_id", "role_id", "category_id", "department_id",
        "name", "username", "password_hash", "email",
        "status", "no_of_login_attempt", "is_deleted",
        "created_by", "updated_by", "created_at", "updated_at"
      )
      SELECT
        gen_random_uuid(), NULL, r."id", NULL, NULL,
        ${env.BOOTSTRAP_ADMIN_NAME}, ${env.BOOTSTRAP_ADMIN_USERNAME}, ${passwordHash}, ${env.BOOTSTRAP_ADMIN_EMAIL},
        'active', 0, false,
        NULL, NULL, now(), now()
      FROM "roles" r
      WHERE r."name" = 'system_admin'
        AND NOT EXISTS (
          SELECT 1 FROM "users" u
          JOIN "roles" ur ON ur."id" = u."role_id"
          WHERE ur."name" = 'system_admin'
        );
    `;

    if (inserted > 0) {
      console.log(`seed-system-admin: created the bootstrap System Admin account (username: ${env.BOOTSTRAP_ADMIN_USERNAME}).`);
    } else {
      console.log('seed-system-admin: a System Admin account already exists — no-op (safe to re-run).');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('seed-system-admin: failed —', error instanceof Error ? error.message : error);
  process.exit(1);
});
