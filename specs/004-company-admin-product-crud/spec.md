# Feature Specification: Company Admin Product Management

**Feature Branch**: `004-company-admin-product-crud`

**Created**: 2026-09-05

**Status**: Draft

**Input**: User description: "GenzFeast is a multi-tenant (multi-company) mobile food ordering platform that connects college canteens (\"companies\"/tenants) with students on their campus. Each canteen operates as an independent tenant with its own staff, products, and orders, while a central System Admin governs onboarding and platform-wide oversight. Analyse the BRD, PRD, Architecture, and UI Design docs and spec the Company Admin flow (create Staff, create product, CRUD category, CRUD department)."

**Scope note**: Of the four capabilities named above, Staff account creation and Category/Department CRUD are already fully specified in `001-company-role-user-setup` (User Stories 2 and 3 there). This spec covers only the remaining, not-yet-specified capability: **Product management** by the Company Admin. See that spec for Staff/Category/Department.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Company Admin Adds a New Product (Priority: P1)

A Company Admin adds a new menu item to their canteen's offering — its name, description, a photo, its price, and whether it's vegetarian — so students can immediately see and order it.

**Why this priority**: Without any products, a canteen's app has nothing for a student to browse or order — this is the foundational capability the rest of the student-facing experience depends on, and it can be built and demonstrated independently of everything else in this feature.

**Independent Test**: Can be fully tested by having a Company Admin submit a new product's details and confirming it is saved, scoped to their own Company, immediately available (not sold out), and visible in their product list.

**Acceptance Scenarios**:

1. **Given** a logged-in Company Admin, **When** they submit a new product with Name, Description, Price, and a Veg/Non-Veg selection, **Then** the product is created, scoped to their Company, and appears in their product list as available (not sold out).
2. **Given** a logged-in Company Admin, **When** they submit a new product including a photo, **Then** the photo is stored and associated with that product for display to students.
3. **Given** a submission missing the Name or Price, or with a Price of zero or less, **When** the Company Admin attempts to save it, **Then** the system rejects the submission with a clear, field-specific error and creates nothing.
4. **Given** Company A and Company B each have their own products, **When** a Company Admin of Company A views their product list, **Then** only Company A's products appear — Company B's are never visible or reachable.

---

### User Story 2 - Company Admin Toggles a Product's Sold-Out Status (Priority: P1)

A Company Admin marks a product sold out when it runs out, and marks it available again once restocked, without touching any of the product's other details.

**Why this priority**: This is the single most frequently performed product action during live service (directly supporting Business Objective O4: staff/admin can reflect stock reality "in ≤ 2 taps"), and it's independently valuable and testable on its own, separate from full editing.

**Independent Test**: Can be fully tested by toggling an existing product's sold-out flag on, confirming it is now marked sold out (and excluded from what students can add to a new order — validated jointly with the student-browsing feature), then toggling it back off and confirming it's available again.

**Acceptance Scenarios**:

1. **Given** an available product, **When** the Company Admin marks it sold out, **Then** its sold-out status updates immediately and none of its other fields (name, description, price, image, veg flag) change.
2. **Given** a sold-out product, **When** the Company Admin marks it available again, **Then** its sold-out status updates immediately, with no other fields affected.
3. **Given** a product that is currently sold out, **When** the Company Admin views their product list, **Then** that product is clearly and visibly distinguished from available products.

---

### User Story 3 - Company Admin Edits an Existing Product (Priority: P2)

A Company Admin updates a product's name, description, photo, price, or veg/non-veg status to correct a mistake or reflect a change (e.g., a price increase).

**Why this priority**: Important for keeping the menu accurate over time, but a canteen can launch and operate for a while on Story 1 (create) and Story 2 (sold-out toggle) alone, so full editing is appropriately sequenced after those.

**Independent Test**: Can be fully tested by updating an existing product's price (or any other editable field) and confirming the change is reflected in that product's record and in what students subsequently see.

**Acceptance Scenarios**:

1. **Given** an existing product, **When** the Company Admin updates its Price, **Then** the new price is saved and reflected the next time the product is viewed.
2. **Given** an existing product, **When** the Company Admin updates its Name, Description, photo, or Veg/Non-Veg selection, **Then** each updated field is saved correctly and every field left unchanged retains its prior value.
3. **Given** an update submission with an invalid value (e.g., Price of zero or less, or a blank Name), **When** the Company Admin attempts to save it, **Then** the system rejects the submission and the product's stored data remains unchanged.

---

### User Story 4 - Company Admin Removes a Product from the Menu (Priority: P2)

A Company Admin takes a product off their menu permanently (a discontinued item), so students no longer see or can order it, without erasing the fact that it was once ordered.

**Why this priority**: Necessary for long-term menu upkeep, but lower priority than being able to add, toggle, and edit products, since a canteen can operate correctly without ever needing to remove an item in its early days.

**Independent Test**: Can be fully tested by removing an existing product and confirming it no longer appears in the active product list or to students browsing, while any historical record that already referenced it (out of this feature's scope to create, but must not break) remains intact.

**Acceptance Scenarios**:

1. **Given** an existing product, **When** the Company Admin removes it, **Then** it no longer appears in the Company Admin's active product list or anywhere a student would browse.
2. **Given** a removed product, **When** anyone looks for it by its identifier directly, **Then** it is treated as no longer available for new orders, but any existing reference to it elsewhere in the system remains valid and unaffected.
3. **Given** a removed product, **When** the Company Admin looks at their product list, **Then** there is no way to accidentally re-select or re-order using that removed product from the normal active-menu view.

---

### Edge Cases

- What happens when a Company Admin attempts to view, edit, toggle, or remove a product belonging to a different Company (via a guessed or manually constructed reference)? (Denied — tenant isolation, consistent with `001-company-role-user-setup`'s isolation model.)
- What happens when a product is toggled sold out (or removed) while it is already sitting in a student's in-progress cart? (Out of this feature's scope — the cart/ordering feature governs that behavior; this feature only guarantees the product's own record correctly reflects its current sold-out/removed state going forward.)
- What happens when two products are created with the identical Name within the same Company? (Allowed — product names are not required to be unique; see Assumptions.)
- What happens when a Company Admin submits a product update that changes nothing (identical values)? (Treated as a normal successful update with no effective change.)
- What happens when an already-removed product is targeted by another update or another removal? (Rejected/not found — a removed product cannot be further edited or removed again through the normal active-product flow.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a Company Admin to create a new Product for their own Company, capturing Name, Description, Price, and a Veg/Non-Veg indicator.
- **FR-002**: System MUST allow a Company Admin to attach a photo to a Product, at creation or later, and MUST make that photo retrievable for display wherever the product is shown to students.
- **FR-003**: System MUST scope every Product to exactly one Company, and MUST prevent any user from a different Company — regardless of role — from creating, viewing, updating, toggling, or removing it. Within a Company, full create/edit/remove authority belongs to that Company's own Company Admin (the sold-out toggle alone is additionally available to Staff, per FR-012). This spec does not grant System Admin any special cross-tenant access to Products — no such access has been established for Products by any other spec.
- **FR-004**: System MUST reject a Product create or update submission that is missing a Name or Price, or whose Price is zero or negative, without creating or modifying anything.
- **FR-005**: A newly created Product MUST default to available (not sold out) unless the Company Admin explicitly marks it sold out at creation.
- **FR-006**: System MUST allow a Company Admin to toggle a Product's sold-out status independently of, and without requiring, any change to its other fields.
- **FR-007**: System MUST allow a Company Admin to update an existing Product's Name, Description, photo, Price, and Veg/Non-Veg indicator, leaving any field not included in the update unchanged.
- **FR-008**: System MUST allow a Company Admin to remove a Product from their active menu; removal MUST be a soft removal that excludes it from the active product list and from student browsing, while preserving the underlying record — and any existing reference to it elsewhere — intact and unaffected.
- **FR-009**: System MUST prevent a removed Product from being further edited, toggled, or removed again through the normal active-product management flow.
- **FR-010**: System MUST allow a Company Admin to view a list of all their Company's active Products, clearly distinguishing which ones are currently sold out.
- **FR-011**: System MUST record `created_by`, `updated_by`, `created_at`, and `updated_at` for every Product, and MUST retain a change history for every creation, update, sold-out toggle, and removal, consistent with the platform's general auditability requirements.
- **FR-012**: The sold-out toggle capability (FR-006) is shared with the Staff role defined elsewhere in the platform — this spec does not restrict sold-out toggling to the Company Admin alone, only full create/edit/remove authority.

### Key Entities

- **Product**: A single menu item offered by one Company — its Name, Description, photo, Price, Veg/Non-Veg status, and current sold-out status. Always scoped to exactly one Company. Removal is a soft removal: the record persists (and any existing reference to it elsewhere remains valid) even once it is no longer part of the active menu.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Company Admin can add a new product and have it appear on their active menu in a single submission, with no engineering involvement.
- **SC-002**: A Company Admin can change a product's sold-out status in two taps or fewer once viewing their product list, matching the platform's stock-accuracy objective.
- **SC-003**: 100% of removed products remain intact and correctly referenced by anything that already pointed to them, with zero broken or missing references.
- **SC-004**: 100% of Products are correctly scoped to exactly one Company, with zero observed instances of cross-tenant visibility or editability.
- **SC-005**: A Company Admin can view their complete current menu — available and sold-out items together, clearly distinguished — in a single screen/interaction.

## Assumptions

- **No product-level food category in V1**: Unlike the student-registration "Category" (a registrant-affiliation classification, per `001-company-role-user-setup`), Products in V1 carry no food-category classification field. This follows the UI Design document's own Product Create/Edit screen spec, which lists only Name, Description, Image, Price, and Is Veg — no category selector — so a food-classification concept for Products is simply not part of V1 scope, not an oversight to fill in here.
- **Photo is optional, not required**: The other four fields (Name, Description, Price, Veg/Non-Veg) are required at creation, but a product photo may be added later; this keeps adding a new item low-friction (consistent with the platform's "onboard and go live fast" objective) while still letting the Company Admin attach one immediately if they have it ready.
- **Product names are not unique**: Nothing in the source documents requires product names to be unique within a Company, and disallowing duplicates could block legitimate cases (e.g., a seasonal variant sharing a name); no uniqueness constraint is assumed.
- **Money is a whole-number amount**: Price is treated as a whole-number amount in the smallest currency unit (e.g., paise), avoiding fractional/floating-point representation, consistent with the platform's general handling of money elsewhere.
- **Soft delete only**: Removing a product never physically deletes its record, mirroring the soft-delete convention already established for Categories, Departments, and Users in `001-company-role-user-setup`.
- **Scope boundary with Staff and student-facing features**: This spec covers only the Company Admin's authoring/management side of Products. The Staff role's parallel ability to toggle sold-out status, and how students browse/add products to a cart, are governed by other (not-yet-specified) features and are referenced here only where this feature's behavior must remain compatible with them (see Edge Cases).
