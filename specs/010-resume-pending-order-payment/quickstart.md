# Quickstart: Validating Resume Payment on a Pending Order

**Feature**: `010-resume-pending-order-payment`

Manual/scriptable validation guide against `contracts/openapi.yaml` and `data-model.md`. Requires `006`'s migrations plus this feature's `payment_attempts` table applied. The race-condition scenarios (3-4) are the most important — they validate the actual bug this feature exists to prevent, not just the happy path.

## Prerequisites

- A running API instance with `payment_attempts` in place.
- A Student account with an order in `payment_pending` (its first `payment_attempts` row already exists from placement, per `006`).
- Ability to simulate `006`'s webhook for an arbitrary `gateway_ref`.

## Scenario 1 — Resume from payment_pending (User Story 1)

1. `POST /student/orders/{orderId}/retry-payment` on a `payment_pending` order.
   - **Expect**: `200` (not `409` — this is the exact behavior `006` previously rejected). A new `payment_attempts` row exists with `is_current: true`; the original attempt's row now has `is_current: false`.
2. `GET /student/orders` for this student.
   - **Expect**: still exactly one order — no duplicate was created (FR-002).
3. Simulate a success webhook for the **new** attempt's `gateway_ref`.
   - **Expect**: order becomes `order_placed` with a pickup code, exactly as a first-attempt success would.

## Scenario 2 — Resume is rejected once resolved (Edge Case)

1. Using the now-`order_placed` order from Scenario 1, `POST .../retry-payment` again.
   - **Expect**: `409` — resuming an already-placed order is rejected (FR-004).

## Scenario 3 — Stale success for a superseded attempt is still honored (research.md §2, the "money already moved" case)

1. Place a fresh order → attempt 1 (`payment_pending`).
2. `POST .../retry-payment` → attempt 2 created, current; attempt 1 now non-current.
3. Simulate a **success** webhook for attempt **1**'s `gateway_ref` (the old, superseded one).
   - **Expect**: the order still becomes `order_placed` with a pickup code — a superseded attempt's success is always honored (research.md §2), since the student genuinely paid via that attempt.
4. Simulate a success webhook for attempt 2's `gateway_ref` afterward.
   - **Expect**: no further change — the order is already `order_placed`; attempt 2's `outcome` is recorded as `success` for audit, but no second pickup code is generated and the order is not re-placed (FR-006/FR-007).

## Scenario 4 — Stale failure for a superseded attempt is ignored (research.md §2, the critical race)

1. Place a fresh order → attempt 1 (`payment_pending`).
2. `POST .../retry-payment` → attempt 2 created, current; attempt 1 now non-current.
3. Simulate a **failure** webhook for attempt **1** (the old, superseded one).
   - **Expect**: the order remains `payment_pending` — a superseded attempt's failure must NOT flip the order to `payment_failed` (this is the exact bug research.md §2 identifies: doing this would permanently block attempt 2's later success). Confirm via `GET` that status is still `payment_pending`.
4. Simulate a success webhook for attempt 2 (the current one).
   - **Expect**: the order becomes `order_placed` normally — unaffected by attempt 1's earlier, correctly-ignored failure.

## Scenario 5 — Order Detail shows a resume prompt (User Story 2)

1. `GET /student/orders/{orderId}` for a `payment_pending` order.
   - **Expect**: `status: payment_pending` in the response; the client renders the "payment in progress" banner + Resume Payment action from this field alone (research.md §5) — no new field is expected in the response body beyond what `006`/`008` already return.

## Pass/Fail

Scenario 4 is the one that matters most: if a superseded attempt's failure is allowed to finalize the order, a real successful payment (Scenario 3's mirror case) could end up permanently stuck. Any deviation from Scenarios 3 or 4's expected outcomes is a blocking failure per SC-002/SC-003 and must not ship.
