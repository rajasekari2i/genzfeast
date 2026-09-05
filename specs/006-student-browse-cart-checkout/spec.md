# Feature Specification: Browse, Cart & Checkout with Payment

**Feature Branch**: `006-student-browse-cart-checkout`

**Created**: 2026-09-05

**Status**: Draft

**Input**: User description: "GenzFeast is a multi-tenant (multi-company) mobile food ordering platform that connects college canteens (\"companies\"/tenants) with students on their campus. Each canteen operates as an independent tenant with its own staff, products, and orders, while a central System Admin governs onboarding and platform-wide oversight. Analyse the BRD, PRD, Architecture, and UI Design docs and spec the user (student/teaching/non_teaching) view product, order product, Cart, place order with payment gateway."

**Scope note**: "Student/teaching/non-teaching" refers to the Category values a person holding the platform's **Student role** can have (established in `001-company-role-user-setup`) — every such person browses, orders, and pays the same way regardless of that value, so this spec refers to them collectively as "the student" throughout. This feature also fully defines the `Order` entity that `005-staff-order-fulfilment-otp` depends on but deliberately left to a future feature (see that spec's Assumptions).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse the Menu and Build a Cart (Priority: P1)

A student opens their canteen's app, sees what's available today, and taps to add the items they want, watching a running summary build as they go.

**Why this priority**: Nothing else in this feature can happen without a way to browse and select items first — this is the entry point of the entire ordering experience.

**Independent Test**: Can be fully tested by opening the product list for a Company, adding several items with varying quantities, and confirming a running summary (item count) reflects the selections without needing to reach checkout.

**Acceptance Scenarios**:

1. **Given** a student viewing their Company's menu, **When** the screen loads, **Then** every non-removed product for that Company is shown with its image, name, description, and price.
2. **Given** a student viewing an available product, **When** they tap to add it, **Then** it is added to their in-progress cart and a running summary of items added becomes visible.
3. **Given** a product that is currently marked sold out, **When** the student views it, **Then** it is clearly and visibly marked as sold out and cannot be added.
4. **Given** a student has added at least one item, **When** they view the running summary, **Then** it shows how many items have been added and offers a way to continue to their cart.

---

### User Story 2 - Review and Adjust the Cart (Priority: P1)

Before paying, a student reviews everything they've selected, adjusts quantities or removes items, and sees the total they'll be charged.

**Why this priority**: This is the last checkpoint before spending money — students need to confirm exactly what and how much they're about to order. It depends on Story 1 having built up a cart.

**Independent Test**: Can be fully tested by opening the cart with a few items already added and confirming each line shows the right product, quantity, and line total, that adjusting a quantity updates the total, and that removing the last unit of an item removes it from the cart entirely.

**Acceptance Scenarios**:

1. **Given** a cart with items in it, **When** the student opens the cart screen, **Then** each item shows its name, description, quantity, and line total, alongside an overall Total Amount.
2. **Given** an item in the cart, **When** the student increases or decreases its quantity, **Then** its line total and the overall Total Amount update immediately.
3. **Given** an item at quantity one, **When** the student decreases it further, **Then** it is removed from the cart entirely.
4. **Given** an item currently in the cart, **When** that same product is marked sold out elsewhere in the meantime, **Then** it remains visible in the cart (not silently removed) so the student can see and decide what to do about it before proceeding.

---

### User Story 3 - Place the Order and Pay (Priority: P1)

With the cart finalized, the student places the order and completes payment through the platform's payment gateway.

**Why this priority**: This is the moment a browsing session actually becomes a real, committed order — the commercial heart of the platform (BRD Objective O3: "100% of V1 orders paid online").

**Independent Test**: Can be fully tested by finalizing a cart, placing the order, and confirming a new order record is created in a payment-pending state with a snapshot of the cart's items and total, and that the student is handed off to complete payment.

**Acceptance Scenarios**:

1. **Given** a finalized cart and an available payment method (auto-selected, since V1 offers exactly one), **When** the student taps Place Order, **Then** an order is created capturing a snapshot of the cart's items (name, price, quantity at that moment) and its total, in a payment-pending state, and the student is handed off to complete payment.
2. **Given** no payment method is selected for any reason, **When** the student tries to place the order, **Then** the action is unavailable until one is selected.
3. **Given** a cart containing a product that has gone sold out since it was added, **When** the student attempts to place the order, **Then** the system rejects the attempt with a clear explanation of which item is no longer available, and the order is not created.
4. **Given** the fulfilment type for V1, **When** an order is created, **Then** it always records Canteen Pickup — no delivery address is ever captured or required.

---

### User Story 4 - Payment Success Confirms the Order with a Pickup Code (Priority: P1)

Once payment is verified as successful, the student sees their order confirmed and receives the code they'll show at the counter to pick it up.

**Why this priority**: This is the payoff of the entire flow — the student needs proof their order is real and a way to actually collect their food. Without this, Story 3 alone leaves the student in limbo.

**Independent Test**: Can be fully tested by simulating a successful payment confirmation for a payment-pending order and confirming its status becomes placed, a pickup code appears, and that code remains visible on demand until the order is picked up.

**Acceptance Scenarios**:

1. **Given** an order in a payment-pending state, **When** the payment gateway confirms the payment succeeded, **Then** the order's status becomes placed and a pickup code is generated for it.
2. **Given** an order that has just become placed, **When** the student views its confirmation, **Then** they see "Order Placed Successfully" along with the pickup code.
3. **Given** an order that is placed but not yet picked up, **When** the student reopens that order at any later point, **Then** the pickup code is still shown to them.
4. **Given** an order has been picked up (delivered, per `005-staff-order-fulfilment-otp`), **When** the student views that order afterward, **Then** the pickup code is no longer shown.
5. **Given** a payment confirmation that arrives after the student has already closed or left the app, **When** the confirmation is processed, **Then** the order still correctly becomes placed with its pickup code generated — completion never depends on the student's app still being open.

---

### User Story 5 - Retry After a Failed Payment (Priority: P2)

If payment doesn't go through, the student sees a clear failure message and can try paying again on the very same order, without it turning into a duplicate.

**Why this priority**: Payment failures are a normal, expected occurrence (network issues, declined UPI transactions) — handling them gracefully matters for real-world usability, but the platform is minimally viable with just the success path (Story 4) demonstrable first.

**Independent Test**: Can be fully tested by simulating a failed payment confirmation for a payment-pending order and confirming its status becomes failed, a retry action is offered, and using it resumes payment on that same order rather than creating a new one.

**Acceptance Scenarios**:

1. **Given** an order in a payment-pending state, **When** the payment gateway confirms the payment failed, **Then** the order's status becomes failed and no pickup code is generated.
2. **Given** an order whose payment has failed, **When** the student views it, **Then** they see "Payment Failed" with a Pay Again action.
3. **Given** an order whose payment has failed, **When** the student uses Pay Again, **Then** payment is retried on that exact same order — no new order is created.
4. **Given** a student with an order still in a payment-pending or payment-failed state, **When** they try to place an entirely new order, **Then** they are directed back to complete or retry that existing order rather than starting a second one in parallel.

---

### Edge Cases

- What happens when a student tries to browse or order from a Company other than the one they registered with? (Denied — a student can only browse and order from their own Company's app, consistent with the platform's tenant-isolation model.)
- What happens when a Company is currently closed for ordering? (Browsing remains available, but placing a new order is blocked with a clear message — closing a Company blocks new orders only, per `001-company-role-user-setup`'s Assumptions.)
- What happens when the payment gateway's confirmation is delayed or never arrives? (The order remains payment-pending; this feature relies on the gateway's own server-to-server confirmation, and does not finalize an order purely from the student's in-app redirect returning.)
- What happens if a student's cart becomes empty (all items removed) — can they still reach checkout? (No — Place Order is only meaningful with at least one item in the cart.)
- What happens to the snapshot of an order's items if the underlying product is later edited or removed? (The order's own snapshot — name, price, quantity at the time of placement — never changes, regardless of what happens to the product afterward.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST show a student every non-removed product belonging to their own Company, with its image, name, description, and price.
- **FR-002**: System MUST visibly and clearly mark a sold-out product as unavailable and MUST prevent it from being added to a cart.
- **FR-003**: System MUST allow a student to add an available product to their in-progress cart and to increase or decrease its quantity, removing it entirely once its quantity reaches zero.
- **FR-004**: System MUST show a running summary of the number of items added while the student continues browsing, and MUST provide a way to proceed from that summary to the full cart view.
- **FR-005**: System MUST show, for each item in the cart, its name, description, current quantity, and a line total, plus an overall Total Amount for the cart.
- **FR-006**: System MUST keep a product visible in the cart even if it becomes sold out after being added, rather than silently removing it.
- **FR-007**: System MUST require a payment method to be selected before an order can be placed, auto-selecting the sole available method by default in V1.
- **FR-008**: On placing an order, System MUST re-validate every item in the cart against its current availability, and MUST reject the attempt — creating no order — if any item has become sold out since being added, clearly identifying which item.
- **FR-009**: On placing an order that passes validation, System MUST create an order in a payment-pending state, capturing a snapshot of each item's name, price, and quantity as they are at that exact moment (not a stale value from when it was first added to the cart), the order's total, and Canteen Pickup as its fulfilment type.
- **FR-010**: System MUST hand the student off to complete payment for a newly created payment-pending order via the platform's payment gateway.
- **FR-011**: System MUST finalize an order's payment outcome only from the payment gateway's own server-to-server confirmation, never solely from the student's in-app return/redirect after leaving to pay.
- **FR-012**: On a confirmed successful payment, System MUST set the order's status to placed, mark its payment as successful, and generate a single-use pickup code for it.
- **FR-013**: System MUST show a placed order's pickup code to the student on its confirmation/detail view for as long as the order has not yet been picked up, and MUST stop showing it once the order has been picked up.
- **FR-014**: On a confirmed failed payment, System MUST set the order's status to failed, mark its payment as failed, generate no pickup code, and offer the student a way to retry payment on that same order.
- **FR-015**: A payment retry on a failed order MUST reuse the existing order — System MUST NOT create a new order as a result of a retry.
- **FR-016**: System MUST prevent a student from having more than one order simultaneously in a payment-pending or payment-failed state — an attempt to place a new order while one is outstanding MUST instead direct the student back to that existing order.
- **FR-017**: System MUST prevent a student from browsing, adding to cart, or placing an order against any Company other than the one their account belongs to.
- **FR-018**: System MUST prevent placing a new order against a Company that is currently closed, while still allowing that Company's menu to be browsed.
- **FR-019**: System MUST record `created_by`/`updated_by`/`created_at`/`updated_at` for every order and MUST retain a change history for every status transition, consistent with the platform's general auditability requirements.
- **FR-020**: An order's item snapshot (name, price, quantity) MUST remain unchanged for the life of that order regardless of any later edit or removal of the underlying product.
- **FR-021**: System MUST NOT provide a student-facing order-cancellation action at any stage in V1 (payment-pending, placed, or otherwise) — an unpaid payment-pending order is simply left unresolved (superseded per FR-016 once the student places or retries another), and any post-payment cancellation/refund need is handled entirely outside the app by operations staff, consistent with the platform's manual refund-handling approach for V1.

### Key Entities

- **Cart**: A student's in-progress, not-yet-committed selection of products and quantities for their own Company. Exists only up to the point of placing an order — it is not itself a permanent record; it becomes one only when it turns into an Order.
- **Order**: A student's committed purchase — a snapshot of items (name, price, quantity), a total amount, a fulfilment type (fixed to Canteen Pickup in V1), a status (`payment_pending` → `order_placed` → `delivered`, or `payment_pending` → `payment_failed`), a payment outcome, and — while placed and not yet delivered — a single-use pickup code. Always scoped to exactly one Company and one student. This is the same entity `005-staff-order-fulfilment-otp` depends on for its "incoming orders" and delivery verification.
- **Payment Outcome**: The result of a payment attempt against an order (pending, succeeded, or failed), which drives whether the order becomes placed or failed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A student can go from opening the app to a successfully placed, paid order in under 3 minutes under normal conditions.
- **SC-002**: 100% of orders are paid online before being marked placed — zero orders reach the placed state without a confirmed successful payment.
- **SC-003**: 100% of orders retain their original item names, prices, and quantities regardless of later changes to the underlying products.
- **SC-004**: 100% of failed-payment retries reuse the original order — zero duplicate orders are created from a retry.
- **SC-005**: 100% of students only ever see and can act on their own Company's menu and their own orders — zero cross-tenant visibility.
- **SC-006**: A pickup code remains available to the student on demand for 100% of placed-but-not-yet-delivered orders, and is never shown once an order is delivered.

## Assumptions

- **No order cancellation in V1**: Resolved via clarification — no student-facing cancel action exists at any order stage (FR-021); an unresolved payment-pending order is simply superseded per FR-016, and any post-payment cancellation/refund is handled manually by operations, outside the app.
- **Cart is ephemeral and client-managed, not a persisted server-side record**: No cart-specific entity appears anywhere across the platform's source documents (only Products and Orders); a cart becomes a durable record only at the moment it turns into an Order (FR-009). It is not guaranteed to survive an app reinstall or a switch to a new device before an order is placed.
- **Single payment method in V1**: PRD's payment-method selector exists as a UI concept, but with exactly one available option (Razorpay, UPI-only, per Architecture) auto-selected by default — there is no actual choice for the student to make in V1, only future-proofing for additional gateways.
- **One outstanding order at a time per student**: Not explicitly stated in the source documents, but a direct, low-risk extension of the already-established rule that a payment retry must never create a duplicate order (FR-8.3/BRD Business Rule 5) — applied here to prevent a student from ever accumulating multiple simultaneously unresolved orders.
- **Price/name are locked in at order-placement time, not at add-to-cart time**: The cart reflects live product data up until the order is actually placed; only the resulting Order snapshot is frozen, consistent with the platform's stated rule that "order line items always reflect the price/name at the time the order was placed, not the product's current data."
- **Payment gateway integration details are a planning concern**: The specific mechanics of initiating a Razorpay/UPI payment session, verifying its webhook signature, and reconciling a retried payment attempt are implementation details for the planning phase, not captured at this business-requirements level.
