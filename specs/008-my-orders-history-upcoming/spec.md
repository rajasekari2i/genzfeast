# Feature Specification: My Orders — History & Upcoming Orders

**Feature Branch**: `008-my-orders-history-upcoming`

**Created**: 2026-09-05

**Status**: Draft

**Input**: User description: "GenzFeast is a multi-tenant (multi-company) mobile food ordering platform that connects college canteens (\"companies\"/tenants) with students on their campus. Each canteen operates as an independent tenant with its own staff, products, and orders, while a central System Admin governs onboarding and platform-wide oversight. Analyse the BRD, PRD, Architecture, and UI Design docs and spec the My Orders — History & Upcoming Orders flow."

**Scope note**: `006-student-browse-cart-checkout` already defines the `Order` entity and the underlying list/detail/retry-payment capabilities a student uses on their own orders. This spec does not redefine that entity or duplicate those endpoints — it specifies the **organization and presentation** of that same data into two views (Upcoming and History) and completes the status-specific content an Order Detail view must show, on top of what `006` already provides.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Upcoming Orders (Priority: P1)

A student opens "My Orders" and sees, in one place, everything they've ordered that isn't finished yet — still waiting on payment or waiting to be picked up.

**Why this priority**: This is the view a student checks most often — "where's my food" — and is independently valuable and testable on its own.

**Independent Test**: Can be fully tested by having a student with one `payment_pending` order and one `order_placed` order open the Upcoming view and confirming both appear, each with enough summary detail to recognize it, while a `delivered` or `payment_failed` order never appears there.

**Acceptance Scenarios**:

1. **Given** a student with orders in `payment_pending` and `order_placed` states, **When** they open the Upcoming view, **Then** both appear, each showing an identifying reference, an item summary, its total, its current status, and when it was placed.
2. **Given** a student with a `delivered` or `payment_failed` order, **When** they open the Upcoming view, **Then** neither of those orders appears there.
3. **Given** a student with no unresolved orders, **When** they open the Upcoming view, **Then** it is empty rather than showing anything from History.

---

### User Story 2 - View Order History (Priority: P1)

A student opens the History view to look back at orders that have already been completed or that failed to go through.

**Why this priority**: Equally fundamental to "My Orders" as the Upcoming view — together they are the complete picture of a student's order activity — but slightly lower priority than Upcoming since it's consulted less frequently (looking back vs. actively waiting).

**Independent Test**: Can be fully tested by having a student with a `delivered` order and a `payment_failed` order open the History view and confirming both appear, while an unresolved order never appears there.

**Acceptance Scenarios**:

1. **Given** a student with a `delivered` order and a `payment_failed` order, **When** they open the History view, **Then** both appear, each showing the same summary detail as an Upcoming card (reference, item summary, total, status, placed time).
2. **Given** a student with a `payment_pending` or `order_placed` order, **When** they open the History view, **Then** neither appears there.
3. **Given** a student with several History orders, **When** they view the list, **Then** the most recently placed order appears first.

---

### User Story 3 - View an Order's Status-Appropriate Detail (Priority: P1)

Tapping any order, from either view, shows the full detail relevant to that specific order's current situation — its items and total always, plus exactly the one extra thing that matters for its status: the pickup code if it's ready for pickup, when it was picked up if it's done, or a way to try paying again if payment failed.

**Why this priority**: This is what makes either list actually useful — a list of orders is only a means to reach the one thing a student actually wants: the right next piece of information or action for a specific order.

**Independent Test**: Can be fully tested by opening the detail view of an order in each of the three reachable statuses (`order_placed`, `delivered`, `payment_failed`) and confirming each shows exactly the content appropriate to that status and nothing extra.

**Acceptance Scenarios**:

1. **Given** an order that is `order_placed`, **When** the student opens its detail, **Then** they see its pickup code alongside its items and total.
2. **Given** an order that is `delivered`, **When** the student opens its detail, **Then** they see when it was delivered, and no pickup code is shown.
3. **Given** an order that is `payment_failed`, **When** the student opens its detail, **Then** they see a Pay Again action, and no pickup code and no delivered time are shown.
4. **Given** an order that is `payment_pending`, **When** the student opens its detail, **Then** neither a pickup code, a delivered time, nor a Pay Again action is shown — none of those apply yet.

---

### Edge Cases

- What happens when a student attempts to open the detail of an order that isn't their own? (Denied — consistent with the ownership rule already established in `006-student-browse-cart-checkout`.)
- What happens if an order's status changes (e.g., from `order_placed` to `delivered`) while the student is looking at its list card or detail view? (The next time the student views or reopens it, it reflects its current status and moves to the correct view — this feature does not require a live, in-place update while a screen is already open.)
- How does this feature treat a "cancelled" order? (No flow anywhere in the platform currently produces a cancelled order — `006-student-browse-cart-checkout` explicitly decided against any in-app cancellation for V1 — so while History conceptually includes cancelled orders for completeness, none will ever actually appear there in V1; see Assumptions.)
- What happens when a student has a very large number of past orders in History? (Out of this feature's scope to define a specific pagination/loading mechanism — left as an implementation detail for the planning phase, so long as the view remains usable.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a student to view their own orders split into two distinct views: Upcoming and History.
- **FR-002**: The Upcoming view MUST show only orders whose status is `payment_pending` or `order_placed`.
- **FR-003**: The History view MUST show only orders whose status is `delivered`, `payment_failed`, or (for forward completeness, though unreachable in V1 per Assumptions) `cancelled`.
- **FR-004**: Each order shown in either view MUST display an identifying reference, a summary of its items, its total amount, its current status, and when it was placed.
- **FR-005**: Within each view, orders MUST be ordered with the most recently placed order first.
- **FR-006**: System MUST allow a student to open any of their own orders, from either view, to see its full detail: its itemized snapshot and total, in addition to its list-level summary information.
- **FR-007**: An order's detail view MUST show its pickup code only while its status is `order_placed`, and MUST never show one for any other status.
- **FR-008**: An order's detail view MUST show when it was delivered only once its status is `delivered`.
- **FR-009**: An order's detail view MUST show a Pay Again action only while its status is `payment_failed`.
- **FR-010**: System MUST prevent a student from viewing any order, in either view or its detail, that does not belong to them.

### Key Entities

- **Order** *(not redefined here — owned by `006-student-browse-cart-checkout`)*: This feature only organizes and presents existing Order data into two filtered, sorted views and completes the status-conditional content of its detail view. No new fields or states are introduced.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A student can locate any specific one of their own orders — whether still unresolved or already completed — within two actions (open My Orders, choose the correct view).
- **SC-002**: 100% of orders shown in Upcoming have an unresolved status, and 100% shown in History have a final status — zero orders appear in the wrong view.
- **SC-003**: 100% of order-detail views show exactly the content appropriate to that order's current status — zero cases of a pickup code appearing on a delivered order, a delivered time appearing on a non-delivered order, or a Pay Again action appearing on anything other than a payment-failed order.
- **SC-004**: 100% of students can view only their own orders across both views and their details — zero cross-student visibility.

## Assumptions

- **"Cancelled" is a reachable-in-schema but unreachable-in-practice status for V1**: The source PRD's own History definition includes cancelled orders, and separately flags as an open question "should a cancelled order in History support any student-facing action?" Since `006-student-browse-cart-checkout` already resolved that no flow in this platform transitions any order to `cancelled` in V1, that open question is moot here: History's filter includes `cancelled` for schema completeness, but no cancelled-specific detail content or action is built, since no order will ever actually be in that state.
- **Sort order is simple recency**: "Most relevant first" (Upcoming) and "most recent first" (History), per the UI Design document, are both implemented as most-recently-placed-first — a single, consistent, easy-to-reason-about ordering rule across both views, absent any more specific relevance rule in the source documents.
- **No live in-place updates required**: A list or detail screen already open does not need to reflect a status change happening at that exact moment; reopening or refreshing the screen is sufficient (consistent with the refresh-on-normal-use approach already assumed for `005-staff-order-fulfilment-otp`'s Incoming Orders view).
- **Pagination/loading strategy is a planning-phase concern**: This spec does not mandate a specific mechanism for handling a large History list, only that the view remains usable.
