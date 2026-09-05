# Quickstart: Validating My Orders — History & Upcoming Orders

**Feature**: `008-my-orders-history-upcoming`

Manual/scriptable validation guide against `contracts/openapi.yaml` and `data-model.md`. Requires `005` and `006`'s migrations applied — no migration of its own. Needs a Student account with orders seeded (or produced via `006`'s own flow) in `payment_pending`, `order_placed`, `delivered`, and `payment_failed` states.

## Prerequisites

- A running API instance with `006`'s `orders` table in place.
- A Student account with four orders, one in each of: `payment_pending`, `order_placed` (with an OTP), `delivered` (with a `delivered_at`), `payment_failed`.

## Scenario 1 — Upcoming view (User Story 1)

1. `GET /student/orders?view=upcoming`.
   - **Expect**: `200`, exactly the `payment_pending` and `order_placed` orders — not the `delivered` or `payment_failed` ones.
2. Confirm ordering: if the `order_placed` order was placed more recently than the `payment_pending` one, it appears first (research.md §2).

## Scenario 2 — History view (User Story 2)

1. `GET /student/orders?view=history`.
   - **Expect**: `200`, exactly the `delivered` and `payment_failed` orders — not the two unresolved ones.
2. Confirm ordering: most recently placed first.

## Scenario 3 — Status-appropriate detail (User Story 3)

1. `GET /student/orders/{id}` for the `order_placed` order.
   - **Expect**: `200`, `otp` populated, `delivered_at: null`.
2. `GET /student/orders/{id}` for the `delivered` order.
   - **Expect**: `200`, `delivered_at` populated, `otp: null` (per `006` FR-013, reaffirmed here).
3. `GET /student/orders/{id}` for the `payment_failed` order.
   - **Expect**: `200`, both `otp` and `delivered_at` are `null` — the client shows Pay Again based on `status` alone, no separate field needed (research.md §3).
4. `GET /student/orders/{id}` for the `payment_pending` order.
   - **Expect**: `200`, both `otp` and `delivered_at` are `null`.

## Scenario 4 — Ownership still enforced (Edge Case)

1. As a different Student, attempt `GET /student/orders/{id}` using the first student's order id.
   - **Expect**: `404` — `006`'s existing RLS/ownership check applies unchanged; this feature adds no new access path.

## Pass/Fail

Any deviation — especially an order appearing in the wrong view (Scenario 1/2), a pickup code surviving past delivery or a delivered timestamp appearing early (Scenario 3), or cross-student access succeeding (Scenario 4) — is a blocking failure per SC-002/SC-003/SC-004 and must not ship.
