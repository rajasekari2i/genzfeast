# Phase 1 Data Model: Staff Order Fulfilment (Incoming Orders & OTP Verification)

**Feature**: `005-staff-order-fulfilment-otp` | **Date**: 2026-09-05

Builds on `001-company-role-user-setup`'s `companies`/`users`. Introduces two tables this feature fully owns (`deliveries`, `order_audit_logs`) and depends on — without fully owning — an `orders` table (research.md §1).

## Entity Relationship Overview

```
companies (1) ──< orders (many)            -- orders table: dependency, see below
orders    (1) ──0..1 deliveries             -- created only once, on successful verification
orders    (1) ──< order_audit_logs (many)
users     (1) ──< deliveries (many, via delivered_by)
```

## Dependency: `orders` (owned by a future Checkout & Payment feature)

This feature does **not** create or migrate this table. It requires the following columns to exist and behave as described, so that whichever feature specifies Checkout & Payment can treat this as a consumer contract:

| Column | Type | Required behavior this feature depends on |
|---|---|---|
| `id` | `uuid` | Stable identifier for an order |
| `company_id` | `uuid` | References `companies(id)` — this feature's RLS/query scoping depends on it |
| `reference` *(derived, not a required stored column)* | — | The `OrderSummary`/`OrderDetail.reference` field in contracts/openapi.yaml is a short, human-readable order reference for Staff to read out loud/match against. This feature derives it from `id` (e.g., a short uppercased prefix of the UUID) at read time rather than depending on a dedicated `orders.reference` column — the owning Checkout & Payment feature is free to add a real stored reference/order-number column later without this feature needing a contract change, since it only ever *displays* whatever short form it derives from `id` today. |
| `status` | `text` (enum) | Must include at least `order_placed` and `delivered` among its values (alongside whatever other states, e.g. `payment_pending`/`payment_failed`/`cancelled`, the owning feature defines); this feature reads rows where `status = 'order_placed'` and is the sole writer of the transition to `delivered` |
| `items` | structured (e.g. `jsonb`) | A snapshot of ordered items (name, quantity, price) — read-only here, for display in FR-002/FR-004 |
| `total_amount` | `integer` | Read-only here, for display in FR-002/FR-004 |
| `otp` | `text` | Must be stored in a form the owning feature can also read back to the student (research.md §2 — **not** a one-way hash); this feature only compares a submitted value against it and never returns it in any Staff-facing response (FR-009) |
| `created_at` | `timestamptz` | Used for "when it was placed" in FR-002 |
| `delivered_at` | `timestamptz`, nullable | Set by this feature (FR-006) at the moment of successful verification |

## 1. `deliveries` (fully owned by this feature)

| Column | Type | Constraints / Notes |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `order_id` | `uuid` | not null, unique, references `orders(id)` — at most one delivery per order (FR-008: a code cannot re-trigger delivery once used) |
| `company_id` | `uuid` | not null, references `companies(id)` — denormalized from the order for direct RLS scoping without a join |
| `delivered_by` | `uuid` | not null, references `users(id)` — the Staff member who performed the successful verification |
| `delivered_at` | `timestamptz` | not null, default `now()` |
| `created_at` | `timestamptz` | not null, default `now()` |

**Constraint**: `UNIQUE (order_id)` — directly enforces "a code can only ever successfully complete delivery once" (FR-008) at the database layer, not just in application logic.

## 2. `order_audit_logs` (fully owned by this feature)

| Column | Type | Constraints / Notes |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `order_id` | `uuid` | not null, references `orders(id)` |
| `company_id` | `uuid` | not null, references `companies(id)` — denormalized for RLS scoping |
| `event_type` | `text` | not null — one of `pickup_verification_succeeded`, `pickup_verification_failed`, `order_delivered` (research.md §3) |
| `performed_by` | `uuid` | nullable, references `users(id)` — the Staff member who submitted the attempt |
| `created_at` | `timestamptz` | not null, default `now()` |

Append-only from the application's perspective — no update/delete path defined here.

## Row Level Security

```sql
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON deliveries
  FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK (company_id = current_setting('app.current_company_id', true)::uuid);
```

`order_audit_logs` uses the identical policy shape. Both tables have no `system_admin` bypass, consistent with `004`'s precedent of not adding cross-tenant access unless a spec explicitly authorizes it — nothing in this spec grants System Admin visibility into order fulfilment.

Access to `orders` itself is governed by whatever RLS the owning (future) feature defines; this feature's API layer additionally restricts the `staff` role to `SELECT` on `status = 'order_placed'` rows and to the one `UPDATE` path that sets `status = 'delivered'` — it does not touch any other order field.

## Validation Rules Summary (from spec Functional Requirements)

| Rule | Source |
|---|---|
| Only orders with `status = 'order_placed'` are "incoming" | FR-001, research.md §4 |
| Correct code → `status = 'delivered'` + a `deliveries` row created | FR-006 |
| Incorrect code → no status change, clear error, retry allowed | FR-007 |
| A code cannot be reused once delivery has completed | FR-008 (enforced by `UNIQUE (order_id)` on `deliveries` + status check) |
| The correct code is never exposed to any Staff-facing response | FR-009 |
| Delivered orders no longer appear as incoming | FR-010, FR-001 |
| Every verification attempt (success or failure) is logged | FR-011 |
| No limit on incorrect attempts | FR-012 |

## State Transitions

**Order status** (this feature only implements the last arrow; the rest belong to the future Checkout & Payment feature):
```
(created) → payment_pending → order_placed → delivered   [this feature: order_placed → delivered]
                            ↘ payment_failed
```

**Delivery**: created exactly once, at the moment of the `order_placed → delivered` transition; never updated or removed by this feature.
