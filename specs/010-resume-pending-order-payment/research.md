# Phase 0 Research: Resume Payment on a Pending Order

**Feature**: `010-resume-pending-order-payment` | **Date**: 2026-09-05

Amends `006-student-browse-cart-checkout`'s retry-payment endpoint and payment webhook handler, and `008-my-orders-history-upcoming`'s Order Detail content rules. This document works out how to actually guarantee FR-006/FR-007 (no duplicate placement, no duplicate pickup code, stale confirmations never overturn an already-finalized order) once more than one payment attempt can exist for the same order.

## 1. The bug a naive fix would introduce, and why a single `payment_gateway_ref` column isn't enough

- **The problem**: `006`'s original design stores exactly one `payment_gateway_ref` directly on `orders`, overwritten on every new attempt. If "resume payment" simply overwrites that column with a new gateway reference, the *old* reference is no longer stored anywhere — so if the original attempt's webhook confirmation arrives late (a real, expected possibility: the student got impatient and hit resume before the first attempt's confirmation came back), the webhook handler's `WHERE payment_gateway_ref = :ref` lookup finds **no order at all**, and a payment the student actually completed is silently dropped, never placing their order.
- **Decision**: Track payment attempts in their own table, `payment_attempts` (one row per attempt, its own unique gateway reference), rather than a single overwritable column on `orders`. Every gateway reference ever issued for an order remains permanently discoverable by the webhook handler, no matter how many times the student has since resumed.
- **Alternatives considered**: Keeping the single-column design and accepting that a late confirmation for a superseded attempt is lost — rejected outright; this would mean a student who successfully paid could still end up with an order stuck unplaced, which is worse than the gap this feature exists to close.

## 2. Reconciliation rule: a success is always honored; a failure only counts from the current attempt

- **Decision**: Each `payment_attempts` row has an `is_current` flag; creating a new attempt (resume) sets the previous one(s) to `is_current = false` before inserting the new current one. The webhook handler, on receiving a confirmation for a specific attempt:
  - **Success**: apply `payment_pending → order_placed` (generate the pickup code) as long as the *order* is still `payment_pending` — **regardless of whether the attempt is the current one**. A successful payment means money actually moved; it must always be honored, even if it arrives late for an attempt the student had already tried to move past.
  - **Failure**: apply `payment_pending → payment_failed` only if the attempt is **both** the current one **and** the order is still `payment_pending`. A failure for a superseded attempt is recorded on that attempt's own row (for audit) but must never flip the order to failed while a newer attempt might still succeed.
- **Rationale**: This is the only rule that satisfies both halves of FR-006/FR-007 simultaneously. If failures from superseded attempts were allowed to finalize the order, a straightforward race (old attempt's failure arrives after the student already started a new, ultimately-successful attempt) would incorrectly fail an order the student actually paid for — and because the order-level status guard (`006`'s original idempotency rule) blocks any further transition once an order leaves `payment_pending`, that incorrect failure would then permanently block the real success from ever being applied. Treating success asymmetrically (always honored) closes that hole; the order's own `status` column remains the single guard preventing more than one transition ever taking effect, satisfying FR-007 without needing to compare attempt recency for the success case at all.
- **Alternatives considered**: Only ever honoring the current attempt's outcome (success or failure alike) — rejected per §1: it reintroduces the "a real successful payment gets lost" bug for the success case, which is strictly worse than the resume-payment gap this feature is meant to close.

## 3. `orders.payment_gateway_ref` becomes a denormalized pointer, not the source of truth

- **Decision**: `orders.payment_gateway_ref` is kept (for any existing code/reporting that reads it directly) but is now just a convenience copy of the *current* attempt's `gateway_ref`, updated each time a resume creates a new current attempt. The webhook handler's authoritative lookup is against `payment_attempts.gateway_ref`, never `orders.payment_gateway_ref`.
- **Rationale**: Avoids a breaking change to `006`'s existing column while fixing the actual lookup path that matters for correctness.
- **Alternatives considered**: Removing the column entirely — rejected as an unnecessary breaking change to `006`'s schema for no correctness benefit; keeping it as a denormalized convenience field costs nothing.

## 4. Retry-endpoint eligibility

- **Decision**: `006`'s existing `POST /student/orders/{orderId}/retry-payment` is amended to accept an order in **either** `payment_pending` or `payment_failed` (previously `payment_failed` only), still returning `409` for any other status (`order_placed`, `delivered`). Calling it always creates a new `payment_attempts` row (marking any prior one non-current) and returns a fresh payment session, exactly as it already does for the `payment_failed` case today.
- **Rationale**: Directly implements FR-001/FR-003 as the simplest possible change — one eligibility condition widened, no new endpoint, no new client-facing concept beyond what `006` already established as "Pay Again."
- **Alternatives considered**: A separate `resume-payment` endpoint distinct from `retry-payment` — rejected; the two are the same action from the student's perspective (spec Assumption), and a single endpoint keeps one place to enforce the attempt-creation/`is_current` logic from §1–§2.

## 5. Order Detail's `payment_pending` content (closing `008`'s gap)

- **Decision**: `008`'s `OrderDetail` response gains no new field beyond what already exists (`status` is already returned) — the "payment in progress" banner and the Resume Payment action are purely client-side, driven by `status === 'payment_pending'`, exactly the same pattern `008`'s research.md §3 already established for deriving "show Pay Again" from `status === 'payment_failed'`.
- **Rationale**: Consistent with the existing convention: the client derives all of its status-conditional UI from the single `status` field rather than a set of separate boolean flags that could disagree with each other.
- **Alternatives considered**: Adding an explicit `can_resume_payment` boolean — rejected for the same reason `008` already rejected an equivalent `can_retry_payment` flag: `status` alone is sufficient and keeps one source of truth.

## Outstanding NEEDS CLARIFICATION

None. The spec shipped with zero clarification markers.
