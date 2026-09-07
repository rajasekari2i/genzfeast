-- Renames the 'staff' role to 'company_staff' and adds 'teaching'/
-- 'non_teaching' as real, first-class roles (explicit product decision —
-- supersedes this session's earlier read of them as Category-only values;
-- CLAUDE.md's documented fixed V1 role set needs updating to match).
--
-- UPDATE, not delete+insert: preserves the existing row's id, so every
-- users.role_id already pointing at 'staff' keeps working with zero data
-- migration needed for the users table itself.

UPDATE "roles" SET "name" = 'company_staff', "updated_at" = now() WHERE "name" = 'staff';

INSERT INTO "roles" ("id", "name", "created_at", "updated_at")
SELECT gen_random_uuid(), v.name, now(), now()
FROM (VALUES ('teaching'), ('non_teaching')) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM "roles" WHERE "roles"."name" = v.name);

-- --- RLS policies referencing the old 'staff' literal ------------------
-- Postgres policy definitions don't follow a renamed value automatically —
-- these three (from 20260906190000_checkout_payment and
-- 20260906200000_payment_attempts) hardcode the role string and must be
-- rewritten. Application-code @Roles()/comparisons are updated separately
-- in this same change (not a migration concern).

DROP POLICY IF EXISTS "staff_company_orders" ON "orders";
CREATE POLICY "staff_company_orders" ON "orders"
  FOR SELECT
  USING (
    current_setting('app.current_role', true) IN ('company_staff', 'company_admin')
    AND "company_id" = NULLIF(current_setting('app.current_company_id', true), '')::uuid
  );

DROP POLICY IF EXISTS "staff_deliver_own_company_orders" ON "orders";
CREATE POLICY "staff_deliver_own_company_orders" ON "orders"
  FOR UPDATE
  USING (
    current_setting('app.current_role', true) = 'company_staff'
    AND "company_id" = NULLIF(current_setting('app.current_company_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.current_role', true) = 'company_staff'
    AND "company_id" = NULLIF(current_setting('app.current_company_id', true), '')::uuid
  );

DROP POLICY IF EXISTS "payment_attempts_select" ON "payment_attempts";
CREATE POLICY "payment_attempts_select" ON "payment_attempts"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "orders" o
      WHERE o."id" = "payment_attempts"."order_id"
        AND (
          (current_setting('app.current_role', true) = 'student'
           AND o."user_id" = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
          OR (current_setting('app.current_role', true) IN ('company_staff', 'company_admin')
              AND o."company_id" = NULLIF(current_setting('app.current_company_id', true), '')::uuid)
        )
    )
  );
