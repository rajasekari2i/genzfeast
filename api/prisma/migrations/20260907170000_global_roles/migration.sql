-- Roles become a global, platform-wide catalog instead of one duplicated
-- set per Company. This replaces 001's original per-company design.
--
-- Why: the per-company auto-seeding trigger (fn_seed_company_roles) had
-- been directly edited in the live database multiple times, outside any
-- tracked migration, ending up with different companies seeded with
-- different, wrong role sets (one company was missing company_admin/staff
-- entirely; another had a bogus company-scoped 'SYSTEM_ADMIN' role, which
-- should never exist — system_admin is platform-wide only). Investigating
-- that surfaced the deeper issue: a role like "staff" means the same thing
-- at every company, so duplicating it per company was never actually
-- necessary, and is exactly what let the seeding drift undetected. Also
-- folds in the fix for a separate pre-existing bug (tracked as issue #32):
-- role names were seeded uppercase (COMPANY_ADMIN, STAFF, ...) while every
-- @Roles()/RLS check in the app compares lowercase — moot once there's a
-- single, deliberately-seeded row per role instead of a trigger-generated
-- one, but fixed here since this migration replaces that exact mechanism.
--
-- Also drops 'teaching'/'non_teaching' entirely: they were seeded as Roles
-- by the original trigger, but CLAUDE.md's fixed V1 role set is only
-- system_admin/company_admin/staff/student — Teaching/Non-Teaching are
-- Category values (a student's registration affiliation), not Roles, and
-- grep across the whole codebase confirms nothing ever read them as a role.

-- Drop the per-company seeding trigger and function — no longer needed;
-- roles are now seeded once, globally, not once per Company.
DROP TRIGGER IF EXISTS "trg_seed_company_roles" ON "companies";
DROP FUNCTION IF EXISTS fn_seed_company_roles();

-- Drop the per-company scoping constraints/indexes/FK/RLS policy — the
-- policy must go before the column it references, or the column drop
-- fails with a dependency error.
ALTER TABLE "roles" DROP CONSTRAINT IF EXISTS "roles_company_id_or_system_admin";
DROP INDEX IF EXISTS "roles_company_name_unique";
DROP INDEX IF EXISTS "roles_global_system_admin_unique";
ALTER TABLE "roles" DROP CONSTRAINT IF EXISTS "roles_company_id_fkey";
DROP POLICY IF EXISTS "roles_select" ON "roles";

-- Remove every existing per-company role row — safe: only one real user
-- exists in this database (the bootstrap system_admin), and it already
-- references the global system_admin row, not any of these. Verified via
-- a direct join against `users` before writing this migration.
DELETE FROM "roles" WHERE "company_id" IS NOT NULL;

ALTER TABLE "roles" DROP COLUMN "company_id";

-- The role name is now unique platform-wide, full stop — this is what
-- "role name should be unique" actually means once there is exactly one
-- row per role rather than one per (company, role) pair.
ALTER TABLE "roles" ADD CONSTRAINT "roles_name_unique" UNIQUE ("name");

-- Seed the fixed, global role set (idempotent — the existing system_admin
-- row is left untouched; company_admin/staff/student are inserted only if
-- missing, so this migration is safe to design around even if re-run
-- against an environment that somehow already has them).
INSERT INTO "roles" ("id", "name", "created_at", "updated_at")
SELECT gen_random_uuid(), v.name, now(), now()
FROM (VALUES ('company_admin'), ('staff'), ('student')) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM "roles" WHERE "roles"."name" = v.name);

-- --- Row Level Security -------------------------------------------------
-- roles is now a shared, non-tenant-sensitive reference table (just role
-- definitions, no per-company data left in it) — every authenticated
-- context, including the pre-auth auth_service actor, can read it freely.
-- (Old policy already dropped above, before the column it referenced.)
CREATE POLICY "roles_select" ON "roles"
  FOR SELECT
  USING (true);
