-- specs/001-company-role-user-setup FR-002a. Governs specs/014's
-- registration mobile-verification delivery channel: true (default) = MSG91
-- SMS with FCM push only as a best-effort failure-fallback (unchanged);
-- false = FCM push directly, MSG91 never attempted. Safe on the existing,
-- already-populated `companies` table: a NOT NULL column with a constant
-- DEFAULT does not rewrite existing rows on Postgres >= 11.
ALTER TABLE "companies" ADD COLUMN "is_sms" BOOLEAN NOT NULL DEFAULT true;
