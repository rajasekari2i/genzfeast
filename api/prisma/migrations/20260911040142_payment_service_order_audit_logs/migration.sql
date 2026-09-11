-- HAND-WRITTEN IN FULL (coding_standard.md §4.2) — no schema.prisma change,
-- adds one missing RLS policy.
--
-- Bug: order_audit_logs (created in 20260906180000_orders_deliveries_audit)
-- only ever got `order_audit_logs_tenant_isolation`, which requires
-- company_id = app.current_company_id. The payment webhook
-- (payments.service.ts handleWebhook) runs under the same system-actor
-- context already established for orders/payment_attempts
-- (payment_service_orders / payment_service_payment_attempts,
-- 20260906190000/20260906200000) — app.current_company_id is set to '' for
-- that context, so NULLIF(...) collapses it to NULL and the tenant-isolation
-- policy's WITH CHECK (company_id = NULL) can never pass. Every webhook that
-- reached the order.update() -> orderAuditLog.create() step failed with
-- "new row violates row-level security policy for table order_audit_logs"
-- and rolled back the whole transaction, silently undoing the order.update()
-- too.
--
-- Fix: the same narrowly-scoped payment_service bypass already used on
-- orders/payment_attempts, mirrored here verbatim (FOR ALL, system-actor
-- check only, no company_id narrowing — matches this codebase's existing
-- convention for this one trusted, signature-verified code path).
CREATE POLICY "payment_service_order_audit_logs" ON "order_audit_logs"
  FOR ALL
  USING (current_setting('app.current_system_actor', true) = 'payment_service')
  WITH CHECK (current_setting('app.current_system_actor', true) = 'payment_service');
