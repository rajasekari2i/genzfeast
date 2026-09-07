-- Adds a gender column to users. Nullable at the DB layer (existing rows
-- predate this column) — required going forward at the DTO layer for the
-- two creation flows that now collect it (student self-registration,
-- Company Admin creating Staff/Company Admin). Not a Prisma enum, matching
-- this schema's existing convention for enum-like string columns (e.g.
-- orders.status, audit_logs.action) — a CHECK constraint enforces the
-- allowed values at the DB layer regardless of which application code path
-- writes the row.

ALTER TABLE "users" ADD COLUMN "gender" TEXT;

ALTER TABLE "users" ADD CONSTRAINT "users_gender_check"
  CHECK ("gender" IS NULL OR "gender" IN ('male', 'female', 'transgender'));
