# Feature Specification: Resume Payment on a Pending Order

**Feature Branch**: `010-resume-pending-order-payment`

**Created**: 2026-09-05

**Status**: Draft

**Input**: User description: "GenzFeast is a multi-tenant (multi-company) mobile food ordering platform that connects college canteens (\"companies\"/tenants) with students on their campus. Each canteen operates as an independent tenant with its own staff, products, and orders, while a central System Admin governs onboarding and platform-wide oversight. Analyse the BRD, PRD, Architecture, and UI Design docs and spec: if the student's order is payment_pending, they can retry the payment by clicking Pay in the UI — the student should not be stuck only being able to retry from payment_failed."

**Scope note**: This closes a gap identified against `docs/ui-screen/06-UI-Design.md` §4.14, which explicitly specifies a "Payment in progress" banner with a Check Status / Resume Payment action for a `payment_pending` order — but `006-student-browse-cart-checkout`'s existing retry mechanism only accepts `payment_failed` orders (rejecting `payment_pending` with an error), and `008-my-orders-history-upcoming`'s Order Detail shows nothing actionable for `payment_pending`. This feature extends both rather than introducing a new entity — it does not redefine the `Order` entity or its status values.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Student Resumes Payment on a Still-Pending Order (Priority: P1)

A student whose order never finished being paid for — they backed out of the payment screen, lost connectivity mid-payment, or simply haven't completed it yet — taps Pay again from that order and continues, without ending up with two orders or being told to wait indefinitely.

**Why this priority**: This is the actual gap: a student can currently get stuck with an order that is neither successfully placed nor cleanly failed, and today has no in-app way to move it forward. This is the core value this feature delivers.

**Independent Test**: Can be fully tested by having a student with an order still in a payment-pending state tap a Pay/resume action on it and confirming they are handed off to complete payment on that exact same order, with no second order created.

**Acceptance Scenarios**:

1. **Given** a student's order is still in a payment-pending state, **When** they choose to pay for it again, **Then** they are handed off to complete payment on that exact same order.
2. **Given** a student resumes payment on a payment-pending order, **When** the action completes, **Then** no new order has been created — only the original order exists.
3. **Given** a student resumes payment and this time the gateway confirms success, **When** that confirmation is processed, **Then** the order becomes placed with a pickup code, exactly as it would from a first attempt.
4. **Given** a student resumes payment and the gateway confirms failure this time, **When** that confirmation is processed, **Then** the order becomes payment-failed, and the student can use the platform's existing Pay Again action from there (per `006-student-browse-cart-checkout`).

---

### User Story 2 - Order Detail Shows an Actionable Prompt for a Pending Order (Priority: P2)

Looking at a still-pending order's detail, a student sees a clear "payment in progress" indication and a way to act on it, instead of a screen that shows nothing useful.

**Why this priority**: This is the visible surface that makes Story 1 discoverable and usable — without it, the capability exists but a student has no way to find it from the order they're looking at.

**Independent Test**: Can be fully tested by opening a payment-pending order's detail view and confirming it shows a distinct "payment in progress" indication together with a way to resume payment, rather than showing nothing (as it does today per `008-my-orders-history-upcoming`).

**Acceptance Scenarios**:

1. **Given** an order that is payment-pending, **When** a student opens its detail, **Then** they see a "payment in progress" indication and an action to resume payment.
2. **Given** an order that is payment-pending, **When** a student views its detail more than once (e.g., they leave and come back), **Then** it continues to reflect its current, up-to-date status each time — if it has since become placed or failed, the detail view shows that instead.

---

### User Story 3 - Multiple Payment Attempts Never Cause a Duplicate Outcome (Priority: P1)

However many times a student resumes payment on the same order, at most one of those attempts ever actually finalizes it — the order is never placed twice, and it never ends up with more than one pickup code.

**Why this priority**: This is a correctness safeguard directly enabled by Story 1 — allowing multiple payment attempts on one order introduces a real risk of a race between two attempts unless explicitly guarded against, and this platform already treats "no duplicate order/pickup code" as a hard business rule (`006`).

**Independent Test**: Can be fully tested by resuming payment on the same order more than once and confirming that only the first attempt the gateway actually confirms as successful is the one that finalizes the order — every other attempt's outcome, whenever it arrives, has no further effect.

**Acceptance Scenarios**:

1. **Given** a student has resumed payment on the same order more than once, **When** the gateway eventually confirms success for any one of those attempts, **Then** the order is placed exactly once, with exactly one pickup code.
2. **Given** an order that has already been finalized (placed or failed) from one payment attempt, **When** a confirmation for a *different*, earlier attempt on that same order arrives afterward, **Then** it has no further effect — the order's already-finalized outcome is not changed.

---

### Edge Cases

- What happens when a student attempts to resume payment on an order that isn't theirs? (Denied — consistent with the ownership rule already established in `006-student-browse-cart-checkout`.)
- What happens when a student attempts to resume payment on an order that has already become placed or failed by the time they act? (Rejected with a clear message reflecting its actual current status — resuming only applies while an order is still payment-pending.)
- Does resuming payment ever conflict with the platform's existing rule that a student can have only one unresolved order at a time (`006-student-browse-cart-checkout` FR-016)? (No — the order being resumed *is* that one unresolved order; resuming it is not treated as creating a second one.)
- What happens if a student never resumes a payment-pending order at all? (It simply remains payment-pending indefinitely; this feature does not introduce any automatic expiry or cancellation — see Assumptions.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a student to initiate a payment retry on their own order while its status is payment-pending, in addition to the already-supported payment-failed case.
- **FR-002**: A payment-resume action on a payment-pending order MUST operate on that exact same order — System MUST NOT create a new order as a result.
- **FR-003**: When a student resumes payment on a payment-pending order, System MUST hand them off to complete payment via the payment gateway, the same way it does for a first attempt.
- **FR-004**: System MUST reject a resume-payment attempt on an order that is not currently payment-pending (e.g., already placed, already failed, or already delivered), with a clear message reflecting the order's actual current status.
- **FR-005**: An order's detail view MUST show a distinct "payment in progress" indication, together with an action to resume payment, for as long as that order remains payment-pending.
- **FR-006**: System MUST correctly finalize an order based on whichever single payment attempt the gateway confirms first as successful, regardless of how many resume attempts were made on that order, and MUST NEVER place the same order more than once or generate more than one pickup code for it as a result.
- **FR-007**: Once an order has been finalized (placed or failed) by one payment attempt, System MUST disregard any later-arriving confirmation for a different attempt on that same order — it MUST NOT change an already-finalized order's outcome.
- **FR-008**: Resuming payment on a payment-pending order MUST NOT be blocked by, or treated as violating, the platform's existing rule limiting a student to one unresolved order at a time (`006-student-browse-cart-checkout` FR-016) — the order being resumed is that one unresolved order, not an additional one.
- **FR-009**: System MUST record every payment-resume attempt in a manner that supports later operational and security auditing, consistent with the platform's general auditability requirements.

### Key Entities

- **Order** *(not redefined here — owned by `006-student-browse-cart-checkout`)*: This feature only extends when a payment retry may be initiated (now including payment-pending, not only payment-failed) and how multiple payment attempts on the same order are safely reconciled. No new fields, entities, or status values are introduced.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of students with a payment-pending order can initiate a new payment attempt on it directly from that order's own detail view, without needing to abandon it, contact support, or wait indefinitely.
- **SC-002**: Zero orders are ever duplicated as a result of a student resuming payment one or more times on the same order.
- **SC-003**: Zero orders are ever placed more than once, and zero duplicate pickup codes are ever generated, regardless of how many payment attempts were made on a given order.
- **SC-004**: 100% of payment-pending orders show a distinct, actionable prompt when viewed in their detail view — never a blank or no-action state.

## Assumptions

- **No automatic expiry introduced**: This feature does not add any automatic timeout or cancellation for a payment-pending order that a student never resumes — it simply remains resumable indefinitely, consistent with the platform's existing decision (`006`) that no in-app order cancellation exists in V1.
- **Extends, not replaces, the existing retry mechanism**: This feature broadens the retry capability `006` already built for payment-failed orders to also cover payment-pending ones, rather than introducing a second, separate mechanism — from the student's perspective, "Pay Again" and "Resume Payment" are the same underlying action applied at two different points in an order's lifecycle.
- **"Check Status" needs no new capability**: The UI Design document's "Check Status / Resume Payment" pairing is satisfied on the "Check Status" half by the already-existing ability to view an order's current status (`006`/`008`); this feature adds only the "Resume Payment" half.
- **Amendment scope, not a new entity**: This feature amends `006-student-browse-cart-checkout`'s retry-eligibility rule and `008-my-orders-history-upcoming`'s Order Detail content rules; it introduces no new entity, table, or Order status value.
