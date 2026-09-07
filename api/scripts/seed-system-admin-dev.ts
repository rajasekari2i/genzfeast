/**
 * DEV-ONLY. A fixed-identity companion to `seed-system-admin.ts`
 * (specs/012-bootstrap-system-admin-seed), for local development
 * convenience only — NOT the production bootstrap path. That script (and
 * 012's own spec, FR-005/research.md §4) deliberately requires
 * per-environment env vars and refuses any hardcoded fallback identity,
 * specifically because a single known username/password baked into a
 * committed file is a real security weakness if it ever runs against a
 * real environment. This script exists anyway, on explicit request, to
 * make local resets convenient — the identity below is a known, public,
 * test-only credential from the moment this file is committed. Never point
 * it at anything but a local/disposable database.
 *
 * Safety gate: refuses to run unless NODE_ENV is unset or explicitly not
 * "production". This is the ONLY gate — it depends on NODE_ENV actually
 * being set correctly in every real environment, which is exactly the kind
 * of "relies on something being configured right" risk 012's own
 * research.md §4 flagged for a checked-in fallback. Treat this file as
 * something to delete before a real deploy pipeline could ever reach it,
 * not as something safe to leave lying around indefinitely.
 *
 * Behavior: idempotent, but as an UPSERT keyed on username (not a
 * create-only no-op like seed-system-admin.ts) — the point of this script
 * is "make this exact account exist with these exact values," so re-running
 * it after changing the constants below updates the existing row in place
 * rather than leaving stale data.
 *
 * Usage:
 *   DATABASE_URL=... npx ts-node scripts/seed-system-admin-dev.ts
 */
import { PrismaClient } from '@prisma/client';
import { PasswordService } from '../src/auth/password.service';

// Fixed dev identity — intentionally not env-driven (see file header).
const DEV_ADMIN = {
  name: 'genzfeast',
  username: '9600158225',
  email: 'genzfeast@gmail.com',
  password: 'test1234',
} as const;

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    console.error('seed-system-admin-dev: refusing to run with NODE_ENV=production. This script is local/dev-only.');
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('seed-system-admin-dev: DATABASE_URL is required (the elevated/migration credential, never APP_DATABASE_URL).');
    process.exit(1);
  }

  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  const passwordService = new PasswordService();

  try {
    // Roles are global, not per-company (migration 20260907170000) — a
    // plain WHERE NOT EXISTS by name, no company_id column exists anymore.
    await prisma.$executeRaw`
      INSERT INTO "roles" ("id", "name", "created_at", "updated_at")
      SELECT gen_random_uuid(), 'system_admin', now(), now()
      WHERE NOT EXISTS (
        SELECT 1 FROM "roles" WHERE "name" = 'system_admin'
      );
    `;

    const passwordHash = await passwordService.hash(DEV_ADMIN.password);

    const existing = await prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "users"
      WHERE lower("username") = lower(${DEV_ADMIN.username}) AND "company_id" IS NULL
      LIMIT 1;
    `;

    if (existing.length > 0) {
      await prisma.$executeRaw`
        UPDATE "users" SET
          "name" = ${DEV_ADMIN.name},
          "email" = ${DEV_ADMIN.email},
          "password_hash" = ${passwordHash},
          "role_id" = (SELECT "id" FROM "roles" WHERE "name" = 'system_admin'),
          "category_id" = NULL,
          "department_id" = NULL,
          "status" = 'active',
          "no_of_login_attempt" = 0,
          "is_deleted" = false,
          "updated_at" = now()
        WHERE "id" = ${existing[0].id}::uuid;
      `;
      console.log(`seed-system-admin-dev: updated the existing dev System Admin account (username: ${DEV_ADMIN.username}).`);
    } else {
      await prisma.$executeRaw`
        INSERT INTO "users" (
          "id", "company_id", "role_id", "category_id", "department_id",
          "name", "username", "password_hash", "email",
          "status", "no_of_login_attempt", "is_deleted",
          "created_by", "updated_by", "created_at", "updated_at"
        )
        SELECT
          gen_random_uuid(), NULL, r."id", NULL, NULL,
          ${DEV_ADMIN.name}, ${DEV_ADMIN.username}, ${passwordHash}, ${DEV_ADMIN.email},
          'active', 0, false,
          NULL, NULL, now(), now()
        FROM "roles" r
        WHERE r."name" = 'system_admin';
      `;
      console.log(`seed-system-admin-dev: created the dev System Admin account (username: ${DEV_ADMIN.username}).`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('seed-system-admin-dev: failed —', error instanceof Error ? error.message : error);
  process.exit(1);
});
