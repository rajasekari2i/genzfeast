# Phase 1 Data Model: Resume Payment on a Pending Order

**Feature**: `010-resume-pending-order-payment` | **Date**: 2026-09-05

Adds one new table, `payment_attempts`, on top of `006-student-browse-cart-checkout`'s `orders` table. No new Order status values; `orders.payment_gateway_ref` is retained but changes meaning (research.md §3).

## Entity Relationship Overview

```
orders (1) ──< payment_attempts (many — one row per payment attempt, old and new)
```

## 1. `payment_attempts` (new)

| Column | Type | Constraints / Notes |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `order_id` | `uuid` | not null, references `orders(id)` |
| `gateway_ref` | `text` | not null, **unique** — the Razorpay reference for this specific attempt; permanently discoverable even after being superseded (research.md §1) |
| `is_current` | `boolean` | not null, default `true` — exactly one `true` row per `order_id` at any time; set to `false` on every prior attempt when a new one is created (research.md §2) |
| `outcome` | `text` (enum) | nullable — `NULL` while awaiting the gateway's confirmation, else `success` or `failed` |
| `created_at` | `timestamptz` | not null, default `now()` |
| `resolved_at` | `timestamptz` | nullable — set when `outcome` is written |

**Constraints**:
- `UNIQUE (gateway_ref)`.
- Partial unique index `UNIQUE (order_id) WHERE is_current = true` — enforces "exactly one current attempt per order" at the database layer, not just application logic.

## Changed meaning: `orders.payment_gateway_ref` (from `006`)

No column change — this field is retained, but is now a **denormalized copy of the current `payment_attempts` row's `gateway_ref`** (updated on every resume), kept for convenience/reporting only. It is no longer the webhook handler's lookup key (research.md §3).

## Row Level Security

`payment_attempts` is scoped identically to `orders` (`006`'s existing `student_own_orders`/`staff_company_orders` policies, joined via `order_id`) — no new RLS concept, since this table only ever exists in the context of an order the same visibility rules already govern. No `system_admin` bypass, consistent with `006`'s precedent.

```sql
ALTER TABLE payment_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY via_owning_order ON payment_attempts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = payment_attempts.order_id
        AND (
          (current_setting('app.current_role', true) = 'student'
           AND o.user_id = current_setting('app.current_user_id', true)::uuid)
          OR (current_setting('app.current_role', true) IN ('staff', 'company_admin')
              AND o.company_id = current_setting('app.current_company_id', true)::uuid)
        )
    )
  );
```

Writes to `payment_attempts` happen only through the trusted backend service paths (the retry-payment endpoint creating a new attempt; the webhook handler writing an outcome) — the same trust boundary `006` already established for `orders` writes.

## Reconciliation Logic Summary (research.md §2)

| Webhook reports | Attempt is current? | Order still `payment_pending`? | Effect |
|---|---|---|---|
| Success | Yes | Yes | Order → `order_placed`, pickup code generated, attempt `outcome = success` |
| Success | No (superseded) | Yes | Order → `order_placed` anyway (money moved — always honored), attempt `outcome = success` |
| Success | either | No (already finalized) | No order change; attempt `outcome = success` recorded for audit only |
| Failure | Yes | Yes | Order → `payment_failed`, attempt `outcome = failed` |
| Failure | No (superseded) | Yes | **No order change** (FR-007) — attempt `outcome = failed` recorded for audit only |
| Failure | either | No (already finalized) | No order change; attempt `outcome = failed` recorded for audit only |

## Validation Rules Summary (from spec Functional Requirements)

| Rule | Source |
|---|---|
| Retry allowed from `payment_pending`, not just `payment_failed` | FR-001 (research.md §4) |
| Resuming never creates a new order | FR-002 |
| Resuming hands the student off to the gateway again | FR-003 |
| Resuming an already-resolved order (`order_placed`/`delivered`) is rejected | FR-004 |
| Order Detail shows a distinct prompt for `payment_pending` | FR-005 (research.md §5) |
| At most one placement / one pickup code regardless of attempt count | FR-006 (research.md §2, `UNIQUE(order_id) WHERE is_current`) |
| A stale confirmation for a superseded attempt never overturns a finalized order | FR-007 (research.md §2) |
| Resuming doesn't violate the one-unresolved-order rule | FR-008 — trivially true: it's an `UPDATE`-shaped action on the existing row, not an `INSERT`, so `006`'s partial unique index on `orders(user_id) WHERE status IN (...)` is never re-evaluated against a second row |

## State Transitions

**`payment_attempts.is_current`**:
```
(new attempt created) → is_current = true
(a newer attempt is created for the same order) → is_current = false (permanent — never reverts)
```

**Order status** — unchanged from `006`, just now reachable via more than one attempt:
```
payment_pending --(any attempt succeeds, order still pending)--> order_placed
payment_pending --(current attempt fails, order still pending)--> payment_failed
payment_failed --(resume: new attempt created)--> payment_pending
payment_pending --(resume while still pending: new current attempt created)--> payment_pending (unchanged; just a new attempt in flight)
```
