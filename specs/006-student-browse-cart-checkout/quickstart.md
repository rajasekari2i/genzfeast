# Quickstart: Validating Browse, Cart & Checkout with Payment

**Feature**: `006-student-browse-cart-checkout`

Manual/scriptable validation guide against `contracts/openapi.yaml` and `data-model.md`. Requires `001`, `002`, and `004`'s migrations applied, plus a Company with at least two Products (one available, one you can toggle sold-out) and a Student account.

## Prerequisites

- A running API instance with the `orders` table and its RLS policies applied.
- A way to simulate a Razorpay webhook call with a valid signature (a test helper, not the real gateway) for both `payment.success` and `payment.failed` events.
- Two Student accounts in two different Companies, for the cross-tenant check.

## Scenario 1 — Browse and cart is client-side only (User Story 1 & 2)

1. As Student A, `GET /student/products`.
   - **Expect**: `200`, every non-removed product for A's company, sold-out ones clearly flagged.
2. Mark one of those products sold out (via `004`'s Staff/Company-Admin toggle) and repeat step 1.
   - **Expect**: that product now shows `is_soldout: true`; no separate cart-side effect exists to check, since the cart is client-only (research.md §1) — this step only confirms the browsing data is live.

## Scenario 2 — Place an order re-validates and snapshots server-side (User Story 3)

1. As Student A, `POST /student/orders` with two items, one of which you marked sold out in Scenario 1.
   - **Expect**: `409`, `unavailable_product_ids` includes that product's id; no order row is created (confirm via `GET /student/orders`).
2. Retry with only the still-available item, `quantity: 2`.
   - **Expect**: `201`, `status: payment_pending`, a `payment_session.gateway_ref`.
3. Inspect the created order's `items` snapshot directly (via `GET /student/orders/{id}`).
   - **Expect**: the snapshotted `price`/`name` match the product's *current* server-side data, not anything the client could have sent (the request body only sent `product_id`/`quantity` — confirms research.md §2).
4. As Student A, `POST /student/orders` again with a different, valid item, while the order from step 2 is still `payment_pending`.
   - **Expect**: `200` (not `201`) — the *existing* payment-pending order is returned unchanged, no second order created (FR-016).

## Scenario 3 — Successful payment (User Story 4)

1. Simulate a `payment.success` webhook for the order from Scenario 2, with a valid signature and matching `gateway_ref`.
   - **Expect**: `200` from the webhook endpoint; a follow-up `GET /student/orders/{id}` shows `status: order_placed`, `otp` populated.
2. `GET /student/orders/{id}` again (simulating the student reopening the app later).
   - **Expect**: the same `otp` value is still returned — it doesn't disappear or regenerate on repeat views (FR-013).
3. Replay the identical `payment.success` webhook a second time.
   - **Expect**: `200` (acknowledged), but the order's `otp` and `updated_at` are unchanged from step 1 — no double-processing (research.md §5).
4. As Student B (different company), `GET /student/orders/{id}` using Student A's order id.
   - **Expect**: `404` — cross-tenant/cross-student access denied (SC-005).

## Scenario 4 — Failed payment and retry (User Story 5)

1. Place a fresh order (Scenario 2 pattern), then simulate a `payment.failed` webhook for it.
   - **Expect**: `200` from the webhook; `GET` on the order shows `status: payment_failed`, `otp` still null.
2. `POST /student/orders/{orderId}/retry-payment`.
   - **Expect**: `200`, a new `payment_session.gateway_ref`, same order `id` as before — confirm via `GET /student/orders` that only one order exists for this student.
3. Simulate `payment.success` for the retried session.
   - **Expect**: that same order transitions to `order_placed` with an OTP — never a second order.

## Scenario 5 — No cancellation action exists (FR-021)

1. Search the contract (`contracts/openapi.yaml`) and confirm there is no cancel/delete endpoint under `/student/orders/*`.
   - **Expect**: none exists — this is a documentation check, not a runtime one, confirming FR-021 wasn't silently implemented anyway.

## Pass/Fail

Any deviation — especially a client-supplied price ever appearing in a stored order (Scenario 2), a duplicate order surviving concurrent placement (Scenario 2 step 4), a re-delivered webhook causing a second state change (Scenario 3 step 3), or cross-student/cross-tenant order visibility (Scenario 3 step 4) — is a blocking failure per SC-002/SC-003/SC-004/SC-005 and must not ship.
