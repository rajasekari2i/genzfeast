# Feature Specification: Audit Trail for Product, Order & Payment Changes

**Feature Branch**: `011-audit-logs-product-order-payment`

**Created**: 2026-09-05

**Status**: Draft

**Input**: User description: "GenzFeast is a multi-tenant (multi-company) mobile food ordering platform that connects college canteens (\"companies\"/tenants) with students on their campus. Each canteen operates as an independent tenant with its own staff, products, and orders, while a central System Admin governs onboarding and platform-wide oversight. Analyse the BRD, PRD, Architecture, and UI Design docs and spec using the audit_logs table to capture audit details for the product, order, and payment flow — using audit_logs wherever it's actually needed for those three."

**Scope note**: This closes Gap #4 from the prior gap analysis — every existing spec's functional requirements reference "the platform's general auditability requirement" (BRD Assumption 8, Architecture §7/§10: "every mutation of a business-critical table is recorded in `audit_logs`... automatically via database triggers"), but no spec ever actually defined that table or mechanism. This feature builds it, scoped exactly to the three flows named in the request: **Product** (`004-company-admin-product-crud`), **Order** (`006-student-browse-cart-checkout`, `005-staff-order-fulfilment-otp`), and **Payment** (`orders`' payment fields plus `010-resume-pending-order-payment`'s `payment_attempts`). It does not extend coverage to Companies, Roles, Categories, Departments, or Users (`001-company-role-user-setup`) — those remain out of scope here, though the mechanism this feature builds is designed to be reusable for them later. This feature is also distinct from, and complementary to, the dedicated event logs other features already built (`auth_audit_logs` in `002`/`003`/`007`, `order_audit_logs` in `005`/`009`) — see Assumptions for how the two kinds of trail differ.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every Product Change Is Automatically Recorded (Priority: P1)

Whenever a Product is created, edited, toggled sold-out, or removed, a record of exactly what changed is captured automatically — without whoever made the change needing to do anything extra, and without a developer needing to remember to add logging code for it.

**Why this priority**: Products are the most frequently mutated business-critical entity in the platform (routine daily edits, sold-out toggles), making this the highest-value and most-exercised case to get right first.

**Independent Test**: Can be fully tested by creating, editing, toggling sold-out, and removing a Product, and confirming each action produces its own audit record capturing what changed, who did it, and when.

**Acceptance Scenarios**:

1. **Given** a Company Admin creates a new Product, **When** the creation succeeds, **Then** an audit record is captured showing the product was created, by whom, and when.
2. **Given** an existing Product, **When** its Name, Description, Price, or Veg/Non-Veg indicator is edited, **Then** an audit record is captured showing the previous and new value of each changed field.
3. **Given** an existing Product, **When** its sold-out status is toggled (by a Company Admin or Staff), **Then** an audit record is captured showing the change and who performed it, regardless of which of those two roles did it.
4. **Given** an existing Product, **When** it is removed (soft-deleted), **Then** an audit record is captured showing the removal, by whom, and when.

---

### User Story 2 - Every Order Lifecycle Change Is Automatically Recorded (Priority: P1)

Whenever an order moves from one status to another — placed, paid, failed, or delivered — a record of that transition is captured automatically.

**Why this priority**: Orders carry real money and are the entity most likely to need after-the-fact investigation (a student dispute, a "why didn't my order go through" support question) — making an automatic, complete lifecycle trail essential.

**Independent Test**: Can be fully tested by driving an order through its lifecycle (created, payment succeeds or fails, delivered) and confirming each status transition produces its own audit record.

**Acceptance Scenarios**:

1. **Given** a student places an order, **When** it is created, **Then** an audit record is captured showing its initial state.
2. **Given** an order's status changes (to placed, to failed, or to delivered), **When** that transition happens, **Then** an audit record is captured showing the previous status, the new status, and when the change occurred.
3. **Given** an order's status is changed by an automated process (e.g., the payment gateway's server-to-server confirmation) rather than a specific person acting in the app, **When** that happens, **Then** the audit record still identifies that the change came from the automated payment-confirmation process, not a blank or misleading "no one."

---

### User Story 3 - Every Payment Attempt Change Is Automatically Recorded (Priority: P1)

Whenever a payment attempt on an order is created or resolves (succeeds or fails), a record of that is captured automatically.

**Why this priority**: Payment attempts are the most financially sensitive data point in the platform (per `010-resume-pending-order-payment`, an order can now have more than one attempt) — an automatic trail here is essential for reconciling exactly what happened when more than one attempt was made on the same order.

**Independent Test**: Can be fully tested by creating a payment attempt and resolving it (success or failure), and confirming each of those moments produces its own audit record.

**Acceptance Scenarios**:

1. **Given** a payment attempt is created for an order (a fresh order placement, or a resume per `010`), **When** it is created, **Then** an audit record is captured showing the attempt's creation.
2. **Given** a payment attempt resolves (the gateway confirms success or failure), **When** that resolution is recorded, **Then** an audit record is captured showing the outcome and when it was recorded.

---

### User Story 4 - Audit Records Are Complete and Cannot Be Altered (Priority: P2)

Every captured audit record reliably identifies who (or what automated process) made the change and exactly when, and once written, a record can never be edited or removed by anyone through normal use of the platform.

**Why this priority**: This is what makes the audit trail actually trustworthy for investigation and dispute resolution — a trail that could be edited after the fact, or that has unreliable "who did this" information, would not be fit for its purpose. It's a cross-cutting guarantee over Stories 1–3 rather than a separately demonstrable flow on its own, so it follows them.

**Independent Test**: Can be fully tested by attempting to modify or delete an existing audit record through the platform's normal channels and confirming no such action is available, and by inspecting a sample of records across all three flows to confirm each has a clear acting identity and timestamp.

**Acceptance Scenarios**:

1. **Given** any existing audit record, **When** anyone looks for a way to edit or delete it through the platform's normal features, **Then** no such capability exists.
2. **Given** any audit record produced by Stories 1–3, **When** it is inspected, **Then** it always identifies who or what performed the change and precisely when it happened — never blank or ambiguous.

---

### Edge Cases

- What happens when a Product, Order, or payment attempt change is made by the platform's own automated process (a payment webhook, a database-driven default) rather than a specific logged-in user? (The record still identifies the change as coming from that automated process by name, never left blank — see User Story 2, Scenario 3.)
- What happens when the exact same field is changed back and forth multiple times in quick succession (e.g., a sold-out toggle flipped on and off repeatedly)? (Each individual toggle produces its own separate audit record — no collapsing or deduplication of rapid changes.)
- Does removing (soft-deleting) a Product also remove or hide its prior audit history? (No — a removed Product's full change history remains intact and inspectable, exactly like the removed Product record itself remains a valid reference per `004-company-admin-product-crud`.)
- How does this feature relate to the dedicated event logs (`auth_audit_logs`, `order_audit_logs`) other features already built? (They are complementary, not overlapping in purpose — see Assumptions. This feature covers *row-level changes*; those cover *events that are not themselves row changes*, such as a failed login or a failed OTP verification attempt.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST automatically capture an audit record for every creation, update, and removal of a Product — including sold-out toggles — without requiring any additional action from whoever performed it.
- **FR-002**: System MUST automatically capture an audit record for every creation of an Order and every change to its status.
- **FR-003**: System MUST automatically capture an audit record for every creation of a payment attempt and every recording of its outcome.
- **FR-004**: Each captured audit record MUST identify, at minimum: which specific record changed, what kind of change it was (created, updated, or removed), the previous and new value of any changed field (for an update), who or what performed it, and precisely when.
- **FR-005**: When a change is made by an automated platform process rather than a specific logged-in user (e.g., a payment-gateway confirmation), the audit record MUST identify that process by name rather than leaving the acting identity blank or attributing it to no one.
- **FR-006**: System MUST NOT provide any way, through normal use of the platform, to edit or delete an existing audit record.
- **FR-007**: A removed (soft-deleted) Product's audit history MUST remain fully intact and inspectable, unaffected by its removal.
- **FR-008**: System MUST capture a separate audit record for each individual change, even when the same field changes back and forth repeatedly in quick succession — no collapsing or deduplication.
- **FR-009**: This feature's audit trail applies only to Products, Orders, and payment attempts; it does not extend to Companies, Roles, Categories, Departments, or Users in this feature's scope.

### Key Entities

- **Audit Record**: An immutable entry describing one specific change to one specific Product, Order, or payment attempt — what changed, its previous and new values, who or what made the change, and when. Once written, never modified or removed. Distinct from, and complementary to, the platform's existing dedicated event logs (`auth_audit_logs`, `order_audit_logs`), which capture events that are not themselves changes to a stored record (see Assumptions).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of Product creations, edits, sold-out toggles, and removals produce a corresponding audit record — zero silent/unlogged changes.
- **SC-002**: 100% of Order status transitions produce a corresponding audit record — zero silent/unlogged transitions.
- **SC-003**: 100% of payment-attempt creations and outcome resolutions produce a corresponding audit record — zero silent/unlogged events.
- **SC-004**: 100% of audit records identify a clear acting identity (a specific user or a named automated process) and an exact timestamp — zero blank or ambiguous entries.
- **SC-005**: Zero audit records are ever alterable or removable through any normal platform feature, at any time after they are written.

## Assumptions

- **Scope is exactly Product, Order, and payment attempts**: As explicitly requested — this feature does not extend the generic audit mechanism to `001-company-role-user-setup`'s entities (Companies, Roles, Categories, Departments, Users), even though those specs also reference "the platform's general auditability requirement." Extending coverage to them is a natural follow-on but is left to a future decision.
- **Complementary to, not a replacement for, existing dedicated event logs**: `auth_audit_logs` (`002`/`003`/`007`) and `order_audit_logs` (`005`/`009`) capture *events that are not themselves a row changing* (a failed login, a failed OTP verification, a notification send attempt) — those needed an explicit, application-level write because no row mutation exists to hang an automatic record off of. This feature's audit trail instead captures the row-level *changes themselves* (a product's price changed, an order's status changed) automatically, without any application code needing to remember to write anything. Both are needed; neither replaces the other.
- **No viewing/query screen in this feature**: Nothing in the UI Design document specifies an audit-log viewing screen anywhere in the platform. This feature is scoped to capturing the audit trail reliably; providing System Admin or Company Admin a way to browse/search it is a reasonable future feature but is not built here.
- **Indefinite retention**: No source document specifies a retention or purge policy for audit records; this feature assumes they are retained indefinitely, consistent with treating them as a permanent compliance/traceability record rather than transient operational data.
- **Only meaningful business fields are tracked for "previous and new value"**: Purely internal bookkeeping columns that trivially change on every write (e.g., a generic "last updated" timestamp) are not themselves treated as a tracked field change requiring its own before/after entry — only fields with actual business meaning (e.g., a Product's price, an Order's status, a payment attempt's outcome) are captured that way.
