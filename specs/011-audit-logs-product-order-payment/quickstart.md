# Quickstart: Validating the Product/Order/Payment Audit Trail

**Feature**: `011-audit-logs-product-order-payment`

This feature has no HTTP endpoints (research.md/plan.md — pure database trigger infrastructure), so validation happens by exercising `004`/`006`/`010`'s existing endpoints and then inspecting `audit_logs` directly (via a test DB connection or an internal admin query — not through any application API, per this feature's scope).

## Prerequisites

- `004`'s `products`, `006`'s `orders`, and `010`'s `payment_attempts` migrations applied, plus this feature's `audit_logs` table and `fn_audit_log()` trigger.
- Direct read access to the database for verification (this feature deliberately grants no application-role `SELECT` on `audit_logs` — see data-model.md).

## Scenario 1 — Product changes (User Story 1)

1. As a Company Admin, `POST /tenant/products` (per `004`) to create a product.
   - **Expect**: a new `audit_logs` row: `table_name='products'`, `action='created'`, `changed_fields IS NULL`, `performed_by_user_id` = that admin's id.
2. `PATCH /tenant/products/{id}` changing `price`.
   - **Expect**: a new row: `action='updated'`, `changed_fields = {"price": {"old": <old>, "new": <new>}}` — and no entry for `updated_at` (excluded, research.md §3).
3. `PATCH /tenant/products/{id}/soldout` toggling sold-out (as Staff this time).
   - **Expect**: a new row: `action='updated'`, `changed_fields = {"is_soldout": {"old": false, "new": true}}`, `performed_by_user_id` = the Staff user's id (confirms FR-001 Scenario 3 — captured regardless of which of the two roles performed it).
4. `DELETE /tenant/products/{id}` (soft-delete).
   - **Expect**: a new row: `action='removed'` (not `'updated'` — research.md §2's `is_deleted` special case), `changed_fields` includes `is_deleted: {old: false, new: true}`.
5. Query `audit_logs` for this product's `record_id` after step 4.
   - **Expect**: all 4 rows from steps 1-4 are still present and unchanged (FR-007 — removal doesn't touch prior history).

## Scenario 2 — Order lifecycle (User Story 2)

1. Place an order (per `006`).
   - **Expect**: `audit_logs` row: `table_name='orders'`, `action='created'`, `performed_by_user_id` = the ordering student.
2. Simulate the payment webhook confirming success.
   - **Expect**: a new row: `action='updated'`, `changed_fields` includes `status: {"old": "payment_pending", "new": "order_placed"}` (and `otp`'s new value, if not excluded — confirm it's captured, since it's a business field, not bookkeeping) — and, per research.md §4, `performed_by_system = 'payment_webhook'`, **not** a blank/null actor (confirms User Story 2 Scenario 3 / FR-005).

## Scenario 3 — Payment attempts (User Story 3)

1. Using `010`'s resume-payment flow, create a second payment attempt on a `payment_pending` order.
   - **Expect**: `audit_logs` row: `table_name='payment_attempts'`, `action='created'`, `company_id` correctly resolved via the join to the owning order (research.md §6) even though `payment_attempts` itself has no `company_id` column.
2. Simulate that attempt resolving (success or failure).
   - **Expect**: a new row: `action='updated'`, `changed_fields` includes `outcome`.

## Scenario 4 — Immutability (User Story 4)

1. Using the application's own database role/connection (not a superuser/admin connection), attempt `UPDATE audit_logs SET changed_fields = '{}' WHERE id = ...`.
   - **Expect**: the database rejects it with a permissions error — `UPDATE` is revoked for that role (research.md §5).
2. Attempt `DELETE FROM audit_logs WHERE id = ...` under the same role.
   - **Expect**: rejected the same way.
3. Scan a sample of rows across all three tables from Scenarios 1-3.
   - **Expect**: every single row has exactly one of `performed_by_user_id`/`performed_by_system` set — never both null, never both set (the `CHECK` constraint, data-model.md §1).

## Pass/Fail

Any deviation — especially a webhook-driven change producing a blank actor (Scenario 2), a soft-deleted product's prior history disappearing (Scenario 1 step 5), or a successful `UPDATE`/`DELETE` against `audit_logs` (Scenario 4) — is a blocking failure per SC-004/SC-005 and must not ship.
