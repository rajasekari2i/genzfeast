# Feature Specification: Staff Order Fulfilment (Incoming Orders & OTP Verification)

**Feature Branch**: `005-staff-order-fulfilment-otp`

**Created**: 2026-09-05

**Status**: Draft

**Input**: User description: "GenzFeast is a multi-tenant (multi-company) mobile food ordering platform that connects college canteens (\"companies\"/tenants) with students on their campus. Each canteen operates as an independent tenant with its own staff, products, and orders, while a central System Admin governs onboarding and platform-wide oversight. Analyse the BRD, PRD, Architecture, and UI Design docs and spec the Staff Operations (product's `is_soldout` flag, view incoming orders, delivered product with verify OTP)."

**Scope note**: Of the three capabilities named above, the Staff-facing sold-out toggle is already fully specified in `004-company-admin-product-crud` (its FR-006/FR-012 and contract explicitly cover Staff, not just Company Admin). This spec covers the two remaining, not-yet-specified capabilities: **viewing incoming orders** and **verifying a pickup OTP to mark an order delivered**. See `004-company-admin-product-crud` for the sold-out toggle.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Staff Views Incoming Orders (Priority: P1)

A Staff member at the canteen counter looks at a list of orders that have been paid for and are waiting to be picked up, so they know what to prepare and hand over next.

**Why this priority**: This is the entry point of the whole fulfilment flow — Staff cannot verify or hand over anything without first knowing what's waiting. It is independently valuable and testable on its own.

**Independent Test**: Can be fully tested by having an order reach the "placed" state (created by a separate, out-of-scope checkout/payment process) and confirming a Staff member of that same canteen sees it appear in their Incoming Orders list with enough detail to recognize it, while a Staff member of a different canteen never sees it.

**Acceptance Scenarios**:

1. **Given** an order has been placed and paid for at a canteen, **When** a Staff member of that same canteen opens Incoming Orders, **Then** the order appears in the list with an identifying reference, a summary of its items, its total amount, and when it was placed.
2. **Given** a Staff member at Canteen A, **When** they view Incoming Orders, **Then** they see only Canteen A's incoming orders — never an order belonging to any other canteen.
3. **Given** an order that has already been marked delivered, **When** a Staff member views Incoming Orders, **Then** that order no longer appears in the list.
4. **Given** an order that is still awaiting payment or whose payment failed, **When** a Staff member views Incoming Orders, **Then** that order does not appear — only orders that have been successfully paid for and placed are "incoming."

---

### User Story 2 - Staff Verifies the Pickup OTP and Completes Delivery (Priority: P1)

A Staff member opens a specific incoming order, asks the student for their pickup code, enters it, and — if it matches — hands over the food and the order is marked delivered.

**Why this priority**: This is the action that actually completes the transaction the whole platform exists to support (BRD Objective O3: OTP-verified pickup); together with Story 1, it forms the minimum viable version of Staff order fulfilment.

**Independent Test**: Can be fully tested by opening an incoming order, submitting its correct pickup code, and confirming the order's status becomes delivered and a record of that fulfilment is created.

**Acceptance Scenarios**:

1. **Given** a Staff member has opened a specific incoming order, **When** they submit the code the student shows them and it matches that order's code, **Then** the order's status becomes delivered and a record of the fulfilment (what was delivered and when) is created.
2. **Given** an order that has just been marked delivered, **When** anyone attempts to submit that same code again for that order, **Then** it is rejected — a code can only ever successfully complete delivery once.
3. **Given** a Staff member viewing an order, **When** they look for the correct code anywhere in the Staff-facing screens, **Then** it is never shown to them — Staff can only submit what the student states, never look up the answer themselves.

---

### User Story 3 - Staff Retries After a Mismatched Code (Priority: P2)

A Staff member enters a code that doesn't match, sees a clear error, and is able to try again immediately without anything else being affected.

**Why this priority**: This is a necessary refinement of Story 2's happy path — the feature is not truly usable without graceful handling of a mistyped or misheard code, but the core "correct code succeeds" behavior (Story 2) is the more fundamental capability.

**Independent Test**: Can be fully tested by submitting an incorrect code against an incoming order and confirming the order's status is unaffected and the Staff member can immediately try again.

**Acceptance Scenarios**:

1. **Given** a Staff member submits a code that does not match the order's code, **When** the system checks it, **Then** it shows a clear inline error, the order's status does not change, and the Staff member can immediately retry.
2. **Given** a mismatched code has just been rejected, **When** the Staff member submits the correct code right afterward, **Then** delivery completes normally, exactly as in Story 2.

---

### Edge Cases

- What happens when a Staff member tries to view or act on an order belonging to a different Company (via a guessed or manually constructed reference)? (Denied — tenant isolation, consistent with the platform's existing isolation model.)
- What happens if two Staff members open the same order at the same time and one of them completes verification first? (The second Staff member's screen reflects the now-delivered status; a second verification attempt on an already-delivered order is rejected the same way as reusing a code — see User Story 2, Scenario 2.)
- What happens when a submitted code is the wrong length or contains non-numeric characters? (Rejected the same way as any other mismatch — a single, clear inline error, no status change.)
- How does the system respond to repeated incorrect code submissions against the same order? There is no limit — Staff may retry as many times as needed (verification happens face-to-face at the counter, a low-stakes, in-person interaction unlike a remote login or password-reset attempt), and every attempt is still recorded per FR-011 so an unusual pattern can be reviewed after the fact.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a Staff member to view a list of their own Company's orders that have been successfully paid for and placed, and are not yet delivered ("incoming orders").
- **FR-002**: The incoming-orders list MUST show, for each order, an identifying reference, a summary of its items, its total amount, and when it was placed.
- **FR-003**: System MUST prevent a Staff member from viewing or acting on any order belonging to a Company other than their own.
- **FR-004**: System MUST allow a Staff member to open a specific incoming order to see its full item-by-item detail and total before verifying pickup.
- **FR-005**: System MUST allow a Staff member to submit a pickup code, presented to them by the student, against the specific order they have open.
- **FR-006**: On a submitted code that matches the order's stored code, System MUST change that order's status to delivered and create a record of the fulfilment (what was delivered and when).
- **FR-007**: On a submitted code that does not match, System MUST show a clear, inline error, MUST NOT change the order's status, and MUST allow the Staff member to retry immediately.
- **FR-008**: Once an order's code has been successfully used to complete delivery, System MUST reject any further submission of that code for that order — it cannot be reused to re-trigger delivery.
- **FR-009**: System MUST NOT expose an order's correct pickup code to the Staff-facing views at any point — Staff only ever submits what the student states, and the system alone determines whether it matches.
- **FR-010**: Once an order's status is delivered, System MUST remove it from the incoming-orders list (FR-001).
- **FR-011**: System MUST record every pickup-code verification attempt (matched or mismatched) and every completed delivery in a manner that supports later operational and security auditing, consistent with the platform's general auditability requirements.
- **FR-012**: System MUST NOT limit the number of incorrect pickup-code submissions allowed against a single order — verification is a low-stakes, in-person, face-to-face interaction at the counter, and every attempt (matched or mismatched) remains fully auditable via FR-011 regardless of how many are made.

### Key Entities

- **Order** *(read and transitioned by this feature; created elsewhere)*: A student's paid, placed purchase — its items, total, current status, and (while awaiting pickup) its single-use pickup code. This feature only ever moves an order from "placed" to "delivered"; it does not create orders, process payment, or generate the pickup code — that is owned by a separate, not-yet-specified Checkout & Payment feature.
- **Delivery**: The record created at the moment an order's pickup code is successfully verified — proof of when and that a specific order was handed over to the student.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A newly placed order becomes visible to the correct canteen's Staff in the Incoming Orders list without any manual refresh action beyond normal app use.
- **SC-002**: A Staff member can complete a successful pickup verification — from opening the order to seeing delivery confirmed — in two actions or fewer (open the order, submit the code).
- **SC-003**: 100% of orders marked delivered through this flow have an accurate, timestamped fulfilment record.
- **SC-004**: 100% of mismatched pickup-code submissions leave the order's status unchanged — zero cases of an order being marked delivered on an incorrect code.
- **SC-005**: 100% of orders are visible and actionable only to Staff of their own Company — zero cross-tenant visibility or action.
- **SC-006**: 100% of delivered orders disappear from the incoming/pending list, so Staff never have to skip past already-completed orders to find the next one.

## Assumptions

- **Orders and their pickup code are created elsewhere**: This feature assumes an order reaching the "placed" state — with its items, total, and pickup code already finalized — as a given starting point. The checkout, payment, and code-generation process itself is owned by a separate, not-yet-specified feature and is entirely out of scope here.
- **No attempt limit on pickup-code verification**: Unlike login lockout and password-reset OTP (both remote, self-service flows with an established recovery path and a documented 5-attempt threshold), pickup-code verification is a face-to-face, in-person counter interaction with no way for the student to simply request a new code — so no attempt limit or lockout is applied here (FR-012); every attempt remains logged (FR-011) for after-the-fact review. No IP- or device-based throttling is introduced either, consistent with the precedent set in `002-registration-login-jwt-auth`.
- **Staff cannot look up the correct code**: Verification is a one-way check — Staff submit what the student states, and only the system determines a match; this preserves the code's purpose as proof the requester is the student who placed the order, not a Staff-convenience lookup.
- **Incoming list refresh mechanism is an implementation detail**: How promptly a newly placed order appears (automatic polling, pull-to-refresh, push-triggered update, etc.) is left to the planning phase; this spec only requires that it appear through normal app use without requiring an app restart.
- **No "undo delivery" in this feature**: Once an order is marked delivered, reversing that (e.g., a mistaken verification) is out of scope for this spec.
- **Scope boundary with sold-out toggle**: The Staff-facing sold-out toggle is fully specified in `004-company-admin-product-crud` and is not redefined here.
