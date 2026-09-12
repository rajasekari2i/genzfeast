-- Closes a real gap: `users_company_username_unique` (company_id, lower(username)
-- WHERE company_id IS NOT NULL) and `users_global_username_unique` (lower(username)
-- WHERE company_id IS NULL) are two SEPARATE partial indexes — nothing checks
-- across them. A tenant user and a system_admin (company_id IS NULL) could
-- already share a username (confirmed live: username 9600158225 existed as
-- both before this migration; remediated by a prior manual data fix that
-- soft-deleted the tenant duplicate and revoked its refresh tokens).
--
-- The needed invariant — "a company_id IS NULL row's username must be unique
-- against every other user, but two company_id IS NOT NULL rows in different
-- companies may still share a username" — compares rows across the null/
-- non-null partition boundary asymmetrically, which no single partial/
-- functional unique index can express. Enforced here with a trigger instead.
--
-- SECURITY DEFINER + SET search_path = public, owned by the migration role,
-- mirroring fn_audit_log()'s own established pattern (20260906210000_audit_logs) —
-- the `users` table is owned by `postgres` with FORCE ROW LEVEL SECURITY off,
-- so a SECURITY DEFINER function bypasses users_tenant_isolation's RLS policy
-- as the table owner. Without this, the trigger's own SELECT would run under
-- the CALLING session's RLS scope — e.g. a company_admin session (the most
-- realistic way this bug is actually triggered, via /tenant/users) would have
-- every company_id IS NULL row silently hidden by users_tenant_isolation's
-- USING clause, and the trigger would compile, apply, and silently do nothing.
--
-- pg_advisory_xact_lock, keyed on lower(username) only (independent of
-- company_id, so both a global row and a tenant row for the same username
-- contend on the identical lock), closes a TOCTOU race a bare `SELECT EXISTS`
-- would otherwise have under this codebase's default READ COMMITTED isolation
-- (confirmed: TenantPrismaService's $transaction requests no isolationLevel).
-- Auto-released at commit/rollback; a second transaction touching the same
-- username blocks until the first resolves, then re-evaluates EXISTS against
-- committed data. hashtext() collisions between different usernames are
-- possible (32-bit hash) but only cause harmless extra serialization between
-- unrelated usernames, never a correctness gap.
CREATE OR REPLACE FUNCTION check_users_cross_partition_username()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_deleted THEN
    RETURN NEW; -- a soft-deleted row can never conflict
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(lower(NEW.username)));

  IF NEW.company_id IS NULL THEN
    -- New/updated system_admin row: must not collide with ANY other active user, any company.
    IF EXISTS (
      SELECT 1 FROM users
      WHERE id <> NEW.id
        AND is_deleted = false
        AND lower(username) = lower(NEW.username)
    ) THEN
      RAISE EXCEPTION 'username already in use by another account'
        USING ERRCODE = 'unique_violation';
    END IF;
  ELSE
    -- New/updated tenant row: must not collide with an existing system_admin (company_id IS NULL) row.
    IF EXISTS (
      SELECT 1 FROM users
      WHERE id <> NEW.id
        AND is_deleted = false
        AND company_id IS NULL
        AND lower(username) = lower(NEW.username)
    ) THEN
      RAISE EXCEPTION 'username already in use by another account'
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- BEFORE INSERT OR UPDATE OF username, company_id, is_deleted (not every
-- column) — fires only on the three columns that can create or resolve a
-- conflict (including un-soft-deleting a row back into contention), not on
-- unrelated updates (password changes, status toggles, etc.).
CREATE TRIGGER users_cross_partition_username_check
  BEFORE INSERT OR UPDATE OF username, company_id, is_deleted ON users
  FOR EACH ROW
  EXECUTE FUNCTION check_users_cross_partition_username();
