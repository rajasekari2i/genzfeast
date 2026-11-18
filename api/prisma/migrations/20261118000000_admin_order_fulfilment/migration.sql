-- Company Admin can fulfil orders, not just Staff.
--
-- Operational reason: a canteen often has one staff account, and when that
-- person is away nobody can hand an order over. The Company Admin is already
-- the account that exists at every tenant, so it becomes the fallback.
--
-- CONTENTS: 100% hand-written. Nothing here is Prisma-generated — this
-- migration changes no table, column or index, only an RLS policy, which
-- schema.prisma does not model (CLAUDE.md: "schema.prisma is not the full
-- source of truth"). Do not "clean this up" by regenerating it.
--
-- Only the UPDATE policy needs changing. The rest of the fulfilment write
-- path already admits a company_admin:
--
--   * orders SELECT   — `staff_company_orders` (20260907180000) already
--                       names both company_staff and company_admin.
--   * deliveries       — `deliveries_tenant_isolation` (20260906180000) is
--                       company-scoped with NO role predicate.
--   * order_audit_logs — `order_audit_logs_tenant_isolation` likewise.
--     `deliveries.delivered_by` is a plain FK to users with no role CHECK,
--     so an admin is recordable as the deliverer and the audit trail keeps
--     naming whoever actually handed the food over.
--
-- The policy is renamed (`staff_` -> `tenant_`) because the old name now
-- states something false about who it admits. Dropping BOTH names makes
-- this safe to apply to a database that has either one.

DROP POLICY IF EXISTS "staff_deliver_own_company_orders" ON "orders";
DROP POLICY IF EXISTS "tenant_deliver_own_company_orders" ON "orders";
CREATE POLICY "tenant_deliver_own_company_orders" ON "orders"
  FOR UPDATE
  USING (
    current_setting('app.current_role', true) IN ('company_staff', 'company_admin')
    AND "company_id" = NULLIF(current_setting('app.current_company_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.current_role', true) IN ('company_staff', 'company_admin')
    AND "company_id" = NULLIF(current_setting('app.current_company_id', true), '')::uuid
  );
