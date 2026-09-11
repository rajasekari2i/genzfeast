-- HAND-WRITTEN IN FULL (coding_standard.md §4.2) — no schema.prisma change,
-- this only replaces the fn_audit_log() function body from
-- 20260906210000_audit_logs/migration.sql.
--
-- Bug: that migration's own comment assumed Postgres short-circuits
-- `TG_TABLE_NAME = 'products' AND (OLD.is_deleted IS DISTINCT FROM
-- NEW.is_deleted) AND ...` so OLD.is_deleted is never touched on orders/
-- payment_attempts (neither has an is_deleted column). That assumption is
-- wrong for `record`-typed OLD/NEW in a trigger function shared across
-- tables with different shapes — reproduced live: any UPDATE on orders or
-- payment_attempts raised `record "old" has no field "is_deleted"`
-- (Prisma surfaced it as "The column `old` does not exist"), which broke
-- every payment webhook (payments.service.ts handleWebhook).
--
-- Fix: use a real PL/pgSQL IF/ELSE branch instead of one boolean
-- expression — PL/pgSQL only compiles/evaluates a branch's statements when
-- control actually reaches it, so OLD.is_deleted is now a separate
-- statement inside `IF TG_TABLE_NAME = 'products' THEN ... END IF` and is
-- never reached for any other table.
CREATE OR REPLACE FUNCTION fn_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_company_id uuid;
  v_changed jsonb := '{}'::jsonb;
  v_old jsonb;
  v_new jsonb;
  v_key text;
  v_user_id text;
  v_system_actor text;
  v_excluded text[] := ARRAY['created_at', 'updated_at', 'created_by', 'updated_by'];
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
  ELSE
    -- research.md §2: an UPDATE is 'removed' only for products' own
    -- soft-delete transition; every other UPDATE (on any of the three
    -- tables) is 'updated'. orders/payment_attempts have no is_deleted
    -- column at all and are never soft-deleted — guarded by a structural
    -- IF (not a boolean AND) so OLD.is_deleted is only ever evaluated when
    -- TG_TABLE_NAME really is 'products'.
    v_action := 'updated';
    IF TG_TABLE_NAME = 'products' THEN
      IF (OLD.is_deleted IS DISTINCT FROM NEW.is_deleted) AND NEW.is_deleted = true THEN
        v_action := 'removed';
      END IF;
    END IF;

    -- research.md §3: diff OLD/NEW, excluding bookkeeping columns that
    -- trivially change on every write and carry no business meaning.
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
      IF v_key = ANY(v_excluded) THEN
        CONTINUE;
      END IF;
      IF v_old -> v_key IS DISTINCT FROM v_new -> v_key THEN
        v_changed := v_changed || jsonb_build_object(v_key, jsonb_build_object('old', v_old -> v_key, 'new', v_new -> v_key));
      END IF;
    END LOOP;
  END IF;

  -- research.md §6: company_id is direct for products/orders, resolved via
  -- a join to the owning order for payment_attempts (which has no
  -- company_id column of its own, per 010).
  IF TG_TABLE_NAME = 'payment_attempts' THEN
    SELECT o."company_id" INTO v_company_id FROM "orders" o WHERE o."id" = NEW."order_id";
  ELSE
    v_company_id := NEW."company_id";
  END IF;

  -- research.md §4: read whichever session variable the caller set —
  -- TenantPrismaService.runInTenantContext always sets both (one to a real
  -- value, the other to ''), so NULLIF collapses the unset one to NULL.
  -- Neither set (empty string on both) → both columns NULL → rejected by
  -- audit_logs_exactly_one_actor, i.e. the write fails loudly rather than
  -- producing a blank-actor row (plan.md's explicit "fail loud" choice).
  v_user_id := NULLIF(current_setting('app.current_user_id', true), '');
  v_system_actor := NULLIF(current_setting('app.current_system_actor', true), '');

  INSERT INTO "audit_logs" (
    "id", "table_name", "record_id", "company_id", "action", "changed_fields",
    "performed_by_user_id", "performed_by_system", "created_at"
  ) VALUES (
    gen_random_uuid(),
    TG_TABLE_NAME,
    NEW."id",
    v_company_id,
    v_action,
    CASE WHEN TG_OP = 'INSERT' THEN NULL WHEN v_changed = '{}'::jsonb THEN NULL ELSE v_changed END,
    v_user_id::uuid,
    v_system_actor,
    now()
  );

  RETURN NEW;
END;
$$;
