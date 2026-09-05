# Phase 1 Data Model: Browse, Cart & Checkout with Payment

**Feature**: `006-student-browse-cart-checkout` | **Date**: 2026-09-05

Builds on `001-company-role-user-setup` (`companies`/`users`) and `004-company-admin-product-crud` (`products`, read-only). **Fully defines and migrates `orders`** — the table `005-staff-order-fulfilment-otp` declared as a dependency contract without owning it (research.md §7). No cart table (research.md §1).

## Entity Relationship Overview

```
companies (1) ──< orders (many)
users     (1) ──< orders (many, via user_id — the ordering student)
products  (*) ── snapshotted into orders.items at placement time (no live FK from an order line back to a product)
orders    (1) ──0..1 deliveries          -- owned by 005, unaffected by this feature
orders    (1) ──< order_audit_logs        -- owned by 005; this feature also writes to it (research.md §5 events)
```

## 1. `orders` (fully defined here — satisfies `005`'s dependency contract)

| Column | Type | Constraints / Notes |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `company_id` | `uuid` | not null, references `companies(id)` |
| `user_id` | `uuid` | not null, references `users(id)` — the ordering student |
| `items` | `jsonb` | not null — snapshot array of `{product_id, name, price, quantity, line_total}`, frozen at placement (FR-009, FR-020); never re-derived from live `products` data after creation |
| `total_amount` | `integer` | not null — whole-number amount in the smallest currency unit, matching `products.price`'s convention |
| `fulfilment_type` | `text` | not null, default `'pickup'` — fixed value in V1 (FR-009); no address fields exist on this table |
| `status` | `text` (enum) | not null, default `'payment_pending'` — one of `payment_pending`, `order_placed`, `payment_failed`, `delivered` |
| `payment_status` | `text` (enum) | not null, default `'pending'` — one of `pending`, `success`, `failed`; mirrors `status` but kept distinct since a future feature (e.g., a refund) could need a payment outcome independent of the order's own lifecycle label |
| `payment_gateway_ref` | `text` | nullable — the Razorpay order reference, set when the payment session is opened (research.md §4); used to correlate the webhook back to this row |
| `otp` | `text` | nullable — 6-digit numeric pickup code, generated once at the `payment_pending → order_placed` transition (FR-012); stored in a form the backend can read back to the student (research.md §2 in `005`, reaffirmed here — **not** a one-way hash, unlike refresh tokens/reset codes) |
| `delivered_at` | `timestamptz` | nullable — set by `005`, not by this feature |
| `created_by` | `uuid` | references `users(id)` — the ordering student (same as `user_id`) |
| `updated_by` | `uuid` | references `users(id)`, nullable — set by whichever actor last changed the row (the webhook handler acts as the system/service identity, not a specific user, for payment transitions) |
| `created_at`, `updated_at` | `timestamptz` | not null, default `now()` |

**Constraints**:
- `CHECK (total_amount > 0)`.
- Partial unique index `UNIQUE (user_id) WHERE status IN ('payment_pending', 'payment_failed')` — enforces FR-016 at the database layer (research.md §3).
- `CHECK (fulfilment_type = 'pickup')` — V1 has no other value; loosened only when a future delivery feature is specified.

No hard-delete path exists for `orders` in this or any feature — an order is a permanent transactional record once created.

## Row Level Security

```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Students see and create only their own orders
CREATE POLICY student_own_orders ON orders
  FOR SELECT USING (
    current_setting('app.current_role', true) = 'student'
    AND user_id = current_setting('app.current_user_id', true)::uuid
    AND company_id = current_setting('app.current_company_id', true)::uuid
  );

CREATE POLICY student_create_own_orders ON orders
  FOR INSERT WITH CHECK (
    current_setting('app.current_role', true) = 'student'
    AND user_id = current_setting('app.current_user_id', true)::uuid
    AND company_id = current_setting('app.current_company_id', true)::uuid
  );

-- Staff/Company Admin see every order in their own company (005 further restricts Staff's
-- list view to status = 'order_placed' at the API layer)
CREATE POLICY staff_company_orders ON orders
  FOR SELECT USING (
    current_setting('app.current_role', true) IN ('staff', 'company_admin')
    AND company_id = current_setting('app.current_company_id', true)::uuid
  );

-- Only the trusted backend service context (payment webhook) or Staff performing the
-- one delivered-transition (005) may update a row; enforced primarily at the API layer,
-- with RLS restricting Staff's UPDATE reach to their own company as a backstop
CREATE POLICY staff_deliver_own_company_orders ON orders
  FOR UPDATE USING (
    current_setting('app.current_role', true) = 'staff'
    AND company_id = current_setting('app.current_company_id', true)::uuid
  )
  WITH CHECK (
    current_setting('app.current_role', true) = 'staff'
    AND company_id = current_setting('app.current_company_id', true)::uuid
  );
```

No `system_admin` bypass (research.md §6) — consistent with `004`/`005`'s precedent of not adding cross-tenant access unless a spec explicitly authorizes it. The payment-webhook handler runs under a separate, trusted service-role connection that bypasses these student/staff-scoped policies by design (it isn't acting "as" any company-scoped user) — this is a backend-internal trust boundary, not a client-facing role.

## Validation Rules Summary (from spec Functional Requirements)

| Rule | Source |
|---|---|
| Only non-removed products shown; sold-out clearly marked and unaddable | FR-001, FR-002 |
| Cart quantity changes are purely client-side until placement | FR-003, FR-004, FR-005, FR-006 (research.md §1) |
| A payment method must be selected (auto-selected, single option in V1) | FR-007 |
| Every cart item re-validated for availability at placement; reject with no order created if any item is now sold out | FR-008 |
| Item snapshot frozen at placement time, from server-side product data, not client-supplied | FR-009, FR-020 (research.md §2) |
| Fulfilment type fixed to pickup | FR-009 |
| Order finalized only by gateway webhook, never client redirect alone | FR-011 (research.md §4) |
| Success → `order_placed` + OTP generated once | FR-012 |
| Pickup code shown until delivered, hidden after | FR-013 |
| Failure → `payment_failed`, no OTP, Pay Again available | FR-014 |
| Retry reuses the same order, never creates a new one | FR-015 |
| At most one `payment_pending`/`payment_failed` order per student | FR-016 (research.md §3) |
| Tenant isolation: own company only | FR-017 |
| Closed company blocks new orders, not browsing | FR-018 |
| No student-facing cancellation at any stage | FR-021 |

## State Transitions

```
(new)
  └─(place order, validation passes)──> payment_pending
                                              │
                          gateway webhook: success
                                              ▼
                                        order_placed ──(005: OTP verified)──> delivered
                                              │
                          gateway webhook: failure
                                              ▼
                                        payment_failed ──(Pay Again, same order)──> payment_pending
```

A duplicate/replayed webhook while already past `payment_pending` is acknowledged but causes no further transition (research.md §5).
