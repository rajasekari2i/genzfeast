-- Renames the third allowed value of users.gender from 'transgender' to
-- 'other', per an explicit product decision (2026-11-19). The column stays a
-- TEXT + CHECK constraint rather than becoming a Prisma enum — same reasoning
-- as 20260908090000_user_gender, which introduced it.
--
-- Order matters: the constraint has to come off before the data can be
-- rewritten, because 'other' is not a legal value while the old CHECK is
-- still in force. Re-added immediately afterwards, inside the same migration,
-- so the table is never left unconstrained once this has run.

ALTER TABLE "users" DROP CONSTRAINT "users_gender_check";

-- Existing rows carry the retired value; they are the same people, only the
-- label changed, so this is a rename rather than a reset to NULL.
UPDATE "users" SET "gender" = 'other' WHERE "gender" = 'transgender';

ALTER TABLE "users" ADD CONSTRAINT "users_gender_check"
  CHECK ("gender" IS NULL OR "gender" IN ('male', 'female', 'other'));
