# Quickstart: Validating Staff Order Fulfilment

**Feature**: `005-staff-order-fulfilment-otp`

Manual/scriptable validation guide against `contracts/openapi.yaml` and `data-model.md`. Requires `001`'s migrations applied, a Staff account belonging to a Company, and — since order creation is out of this feature's scope — at least one `orders` row seeded directly (via test fixture/SQL) in each state needed below, standing in for the not-yet-specified Checkout & Payment feature.

## Prerequisites

- A running API instance with `deliveries` and `order_audit_logs` tables applied, alongside a (fixture) `orders` table matching the dependency contract in `data-model.md`.
- Two Companies (A and B), each with a Staff account.
- Seeded order fixtures: one `order_placed` order for Company A with a known pickup code; one `payment_pending` and one `delivered` order for Company A (to confirm exclusion).

## Scenario 1 — Incoming orders list (User Story 1)

1. As Company A's Staff, `GET /tenant/staff/orders`.
   - **Expect**: `200`, containing the `order_placed` fixture, with a reference, item summary, total, and placed time — and **not** containing the `payment_pending` or `delivered` fixtures.
2. As Company B's Staff, `GET /tenant/staff/orders`.
   - **Expect**: `200`, an empty (or Company-B-only) list — Company A's order never appears.
3. `GET /tenant/staff/orders/{orderId}` for the `order_placed` fixture.
   - **Expect**: `200`, full item-by-item detail — response body does **not** contain the pickup code anywhere (FR-009).

## Scenario 2 — Successful verification (User Story 2)

1. `POST /tenant/staff/orders/{orderId}/verify` with the fixture's known correct code.
   - **Expect**: `200`, `status: delivered`, `delivered_at` populated.
2. Check `deliveries`: exactly one row exists for this `order_id`, with `delivered_by` set to the acting Staff user.
3. Check `order_audit_logs`: a `pickup_verification_succeeded` row (and/or `order_delivered`) exists for this order.
4. `GET /tenant/staff/orders` again.
   - **Expect**: the now-delivered order no longer appears (FR-010).
5. Repeat step 1 (same code, same now-delivered order).
   - **Expect**: `409` — cannot re-trigger delivery (FR-008).

## Scenario 3 — Mismatch and retry (User Story 3)

1. Seed a fresh `order_placed` fixture. `POST .../verify` with an incorrect code.
   - **Expect**: `422`, order's `status` unchanged (still `order_placed`, confirm via a follow-up `GET`).
2. Check `order_audit_logs`: a `pickup_verification_failed` row exists.
3. Immediately `POST .../verify` again on the same order, this time with the correct code.
   - **Expect**: `200`, delivered — normal success, unaffected by the prior mismatch.

## Scenario 4 — No attempt limit (FR-012)

1. On a fresh `order_placed` fixture, submit an incorrect code 10 times in a row.
   - **Expect**: all 10 return `422`; the order remains `order_placed` and still accepts a correct code afterward (no lockout, no throttling response).
2. Submit the correct code.
   - **Expect**: `200` — succeeds normally regardless of the prior failed attempts.

## Pass/Fail

Any deviation — especially the pickup code appearing anywhere in a Staff-facing response (Scenario 1), a payment-pending/delivered order appearing as "incoming" (Scenario 1), or a second delivery being recorded for the same order (Scenario 2) — is a blocking failure per SC-004/SC-005/SC-006 and must not ship.
