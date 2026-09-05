# Phase 1 Data Model: My Orders — History & Upcoming Orders

**Feature**: `008-my-orders-history-upcoming` | **Date**: 2026-09-05

No new tables, no migration, no new RLS policy. This feature adds query filters and one response field on top of `006-student-browse-cart-checkout`'s existing `orders` table and its existing `student_own_orders`/`student_create_own_orders` RLS policies.

## Reused: `orders` columns (from `006`, no changes)

| Column | This feature's use |
|---|---|
| `status` | Filter predicate: `IN ('payment_pending','order_placed')` for Upcoming; `IN ('delivered','payment_failed','cancelled')` for History (research.md §1, §4) |
| `created_at` | Sort key, `DESC`, for both views (research.md §2) |
| `delivered_at` | Newly included in the Order Detail response (research.md §3) — column already exists, owned by `005`/`006` |
| `otp` | Already included in `006`'s Order Detail response; reused unchanged here |
| `items`, `total_amount`, `id`, `fulfilment_type` | Already part of `006`'s `Order`/`OrderDetail` schemas; reused unchanged |

## Validation Rules Summary (from spec Functional Requirements)

| Rule | Source |
|---|---|
| Upcoming shows only `payment_pending`/`order_placed` | FR-002 |
| History shows only `delivered`/`payment_failed`/(unreachable) `cancelled` | FR-003 |
| Both views sorted most-recently-placed-first | FR-005 |
| Pickup code shown only while `order_placed` | FR-007 (already enforced by `006` FR-013; reaffirmed) |
| Delivered timestamp shown only once `delivered` | FR-008 |
| Pay Again shown only while `payment_failed` | FR-009 (client-derived from `status`, research.md §3) |
| A student sees only their own orders | FR-010 (enforced by `006`'s existing RLS — no new policy needed) |

## State Transitions

None introduced by this feature — it reads the same `orders.status` state machine `006` and `005` already define, without adding or changing any transition.
