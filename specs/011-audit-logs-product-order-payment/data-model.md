# Phase 1 Data Model: Audit Trail for Product, Order & Payment Changes

**Feature**: `011-audit-logs-product-order-payment` | **Date**: 2026-09-05

Adds one new table, `audit_logs`, and one generic trigger function attached to three existing tables (`products` from `004`, `orders` from `006`, `payment_attempts` from `010`). No changes to any existing table's columns.

## Entity Relationship Overview

```
products         (1) ──< audit_logs (many, table_name='products')
orders           (1) ──< audit_logs (many, table_name='orders')
payment_attempts (1) ──< audit_logs (many, table_name='payment_attempts')
users            (1) ──< audit_logs (many, via performed_by_user_id, nullable)
```

## 1. `audit_logs` (new)

| Column | Type | Constraints / Notes |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `table_name` | `text` | not null — `'products'` \| `'orders'` \| `'payment_attempts'` |
| `record_id` | `uuid` | not null — the `id` of the affected row on that table |
| `company_id` | `uuid` | nullable, references `companies(id)` — denormalized (research.md §6); for `payment_attempts`, resolved via a join to its owning order at write time |
| `action` | `text` (enum) | not null — `'created'` \| `'updated'` \| `'removed'` (research.md §2) |
| `changed_fields` | `jsonb` | nullable — `{"field_name": {"old": ..., "new": ...}}` for each changed, non-excluded column; `NULL` for `action = 'created'` (nothing to diff against) |
| `performed_by_user_id` | `uuid` | nullable, references `users(id)` — set when the change came from an authenticated user (research.md §4) |
| `performed_by_system` | `text` | nullable — set when the change came from an automated process (e.g., `'payment_webhook'`); exactly one of this and `performed_by_user_id` is always non-null (FR-005) |
| `created_at` | `timestamptz` | not null, default `now()` — when the change was recorded (always equals the underlying change's own timestamp, since the trigger fires synchronously in the same transaction) |

**Constraints**:
- `CHECK ((performed_by_user_id IS NOT NULL) <> (performed_by_system IS NOT NULL))` — exactly one actor identity is always present, never both, never neither (FR-005, SC-004).
- Index on `(table_name, record_id, created_at)` — the natural "full history of this one record" query shape a future viewing feature would use.

**Privileges**: the application's database role has `UPDATE` and `DELETE` revoked on this table; only the trigger's own `INSERT` is possible through normal application access (research.md §5, FR-006).

**Row Level Security**: enabled, with no `SELECT` policy granted to any application role — no application-facing read path exists in this feature (spec Assumption, research.md §6).

## 2. Trigger attachment (no schema change to the target tables themselves)

```sql
CREATE TRIGGER audit_products
  AFTER INSERT OR UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER audit_orders
  AFTER INSERT OR UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER audit_payment_attempts
  AFTER INSERT OR UPDATE ON payment_attempts
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
```

`fn_audit_log()` (research.md §1-§4, described here at the data-model level, not as literal function source):
1. Determine `action` from `TG_OP` and, for `products` specifically, the `is_deleted` transition (research.md §2).
2. For `UPDATE`, diff `OLD`/`NEW` excluding `created_at`/`updated_at`/`created_by`/`updated_by`, producing `changed_fields` (research.md §3).
3. Resolve `company_id`: directly from `NEW.company_id` for `products`/`orders`; via a lookup against `orders` using `NEW.order_id` for `payment_attempts`.
4. Resolve the actor from `app.current_user_id` or `app.current_system_actor` (research.md §4).
5. Insert one `audit_logs` row.

## Validation Rules Summary (from spec Functional Requirements)

| Rule | Source |
|---|---|
| Every Product create/update/soldout-toggle/remove is captured | FR-001 |
| Every Order creation and status change is captured | FR-002 |
| Every payment attempt creation and outcome is captured | FR-003 |
| Each record has: what changed, action kind, before/after values, actor, timestamp | FR-004 |
| Automated-process changes name the process, never blank | FR-005 (research.md §4) |
| No edit/delete path for an existing record | FR-006 (research.md §5) |
| A removed Product's audit history remains intact | FR-007 — trivially true: `audit_logs` rows are never deleted when the Product they reference is soft-deleted (they reference `record_id`, not a live FK requiring the row to still exist as non-deleted) |
| Rapid repeated changes each get their own record | FR-008 — trivially true: the trigger fires once per statement/row, with no dedup logic |
| Scope limited to Product/Order/payment attempts | FR-009 |

## State Transitions

No state machine of its own — `audit_logs` is strictly append-only (research.md §5). It observes, but does not alter, the state machines already owned by `004` (Product), `006` (Order), and `010` (payment attempt).
