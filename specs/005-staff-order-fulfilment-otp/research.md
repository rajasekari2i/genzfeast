# Phase 0 Research: Staff Order Fulfilment (Incoming Orders & OTP Verification)

**Feature**: `005-staff-order-fulfilment-otp` | **Date**: 2026-09-05

Depends on `001-company-role-user-setup` (`companies`/`users`/RLS pattern) and reuses the NestJS/Supabase-Postgres baseline established there. This feature is also the first to touch `orders`, a table it does not own — see §1. This document resolves the implementation-pattern unknowns specific to Staff-side fulfilment.

## 1. Ownership boundary on the `orders` table

- **Decision**: This feature treats `orders` as a **dependency**, not something it creates end-to-end. It specifies the minimum set of columns it needs to already exist (data-model.md's "Dependency" section) and only implements the `order_placed → delivered` transition. Creating an order, driving `payment_pending → order_placed`/`payment_failed`, and generating the pickup code are explicitly the responsibility of a separate, not-yet-specified Checkout & Payment feature (per the spec's own Assumptions).
- **Rationale**: The spec is explicit that order creation/payment is out of scope here (User Story 1's Independent Test even says the placed order is "created by a separate, out-of-scope checkout/payment process"). Fully designing the `orders` table's payment fields in this plan would mean guessing at a future feature's schema instead of that feature's own `/speckit-plan` doing so — this plan instead documents a consumer-driven contract: the columns Staff fulfilment needs, so whichever feature builds Checkout & Payment knows what it must provide.
- **Alternatives considered**: Fully designing `orders` (including `payment_status`, `payment_gateway_ref`, and the `payment_pending`/`payment_failed` transitions) here — rejected as scope creep into a feature this one explicitly defers; if this plan's guess turns out wrong, it would need rework anyway once the Checkout & Payment feature is actually specified.

## 2. Where the pickup code is stored — deliberately NOT hashed like other codes

- **Decision**: Unlike the refresh token (`002`, hashed) and the password-reset code (`003`, hashed), the order's pickup code is stored in a form the backend can read back and return to the student's own "My Order" view for as long as the order is `order_placed` (per PRD FR-8.4/FR-11.2/FR-11.4, which require the code to be re-displayable to the student on demand, not shown only once at generation).
- **Rationale**: A one-way hash (as used for refresh tokens and password-reset codes) can only ever be *compared against*, never *displayed back* — but this code's product requirement is fundamentally different: the student must be able to reopen their order detail screen at any time before pickup and see their code again. Hashing it would make that requirement impossible to satisfy. This feature's own verification (FR-005/FR-006/FR-009) only ever *compares* what Staff submits against the stored value and never displays it to Staff — that one-way exposure control is enforced by authorization/response-shaping (never including the field in any Staff-facing response), not by hashing the value itself.
- **Alternatives considered**: Hashing it and accepting the student can never see it again after initial generation — rejected outright, since it directly contradicts FR-8.4 ("displayed on the order confirmation/detail screen for as long as the order is not yet delivered"), which is an already-decided PRD requirement, not something this feature can silently override.

## 3. Auditing OTP verification attempts (including mismatches)

- **Decision**: A dedicated `order_audit_logs` table, written by application code for three event types: `pickup_verification_succeeded`, `pickup_verification_failed`, and `order_delivered` (the last being somewhat redundant with the order row's own `status`/`delivered_at`, but kept for a single consistent place to query "everything that happened during this order's fulfilment").
- **Rationale**: This is the same reasoning `002`'s research.md §6 already established for `auth_audit_logs`: a *failed* verification attempt doesn't mutate the order row at all (FR-007: "MUST NOT change the order's status"), so a generic row-mutation trigger (the platform's usual `audit_logs` pattern for tables like `products`) cannot capture it — an explicit application-level write is the only way to satisfy FR-011 for the mismatch case.
- **Alternatives considered**: Extending `002`'s `auth_audit_logs` table with order-related event types — rejected: that table is keyed and scoped around `users`/authentication concerns (login, logout, password reset), and an order-fulfilment event doesn't fit its shape (no natural `user_id` for "which student," and it would need an `order_id` foreign key that has no reason to live on an auth-focused table). A dedicated table keeps each concern's audit trail coherent on its own terms.

## 4. Distinguishing "incoming" from every other order status

- **Decision**: The incoming-orders query filters `WHERE company_id = :company_id AND status = 'order_placed'`. No new status values are introduced by this feature; `payment_pending`, `payment_failed`, and `cancelled` (all owned by the future Checkout & Payment feature) are simply never returned by this query, and `delivered` orders are excluded by the same filter once this feature transitions them.
- **Rationale**: Directly implements FR-001/FR-010 and Edge Case/Acceptance Scenario 1.4 (payment-pending/failed orders never appear as "incoming"). Using the existing `status` column (rather than a separate boolean flag) keeps a single source of truth for an order's state, consistent with how `001` and `004` use a single status/flag column rather than parallel booleans.
- **Alternatives considered**: A separate `is_incoming` boolean maintained alongside `status` — rejected as redundant state that could drift out of sync with `status` itself.

## 5. No attempt-limit enforcement mechanism needed

- **Decision**: Per the spec's resolved FR-012 (no limit on incorrect pickup-code submissions), no counter, lockout, or throttling logic is implemented for this endpoint beyond the audit logging already covered in §3.
- **Rationale**: This is a direct implementation of the spec's own explicit decision — noting it here only to make clear that the *absence* of a rate-limit is deliberate, not an oversight, since every other OTP-like flow in this platform (`002` login, `003` password reset) does have one.
- **Alternatives considered**: N/A — this is a documented spec decision, not an open implementation choice.

## Outstanding NEEDS CLARIFICATION

None. The spec's one clarification (attempt-limit policy) was already resolved during `/speckit-specify` (FR-012: no limit).
