# Feature Specification: Company, Role, Category, Department & User Creation

**Feature Branch**: `001-company-role-user-setup`

**Created**: 2026-09-05

**Status**: Draft

**Input**: User description: "GenzFeast is a multi-tenant (multi-company) mobile food ordering platform that connects college canteens (\"companies\"/tenants) with students on their campus. Each canteen operates as an independent tenant with its own staff, products, and orders, while a central System Admin governs onboarding and platform-wide oversight. Analyse the BRD, PRD, Architecture, and UI Design docs and spec the company, role, category, department, and user creation flow."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - System Admin Onboards a New Tenant (Priority: P1)

A System Admin brings a new college canteen onto the platform by creating its Company record and provisioning the first Company Admin account for it, so that canteen can immediately start managing its own staff, master data, and products without any engineering involvement.

**Why this priority**: Nothing else in the platform can exist without a Company and at least one Company Admin — this is the root of every other flow (staff, categories, departments, students, products, orders). It directly delivers Business Objective O2 ("new tenant onboarded and live in under 1 day").

**Independent Test**: Can be fully tested by having a System Admin create a Company record and then create its first Company Admin user, and verifying that user can log in and see only that Company's (empty) workspace — delivers value on its own as a self-serve tenant onboarding capability.

**Acceptance Scenarios**:

1. **Given** a System Admin is logged in, **When** they submit a new Company with name, contact person, mobile, email, and address, **Then** a new Company record is created with a default "open" status and a default set of Company-scoped roles is established for it.
2. **Given** a newly created Company with no users yet, **When** the System Admin creates its first user and assigns the Company Admin role, **Then** that user can log in and is scoped exclusively to the new Company.
3. **Given** an existing Company, **When** the System Admin toggles its open/closed status, **Then** the new status is immediately reflected platform-wide for that Company.
4. **Given** two different Companies exist, **When** the System Admin views the company list, **Then** both are listed with their own independent status, without any mixing of one company's data into the other's view.

---

### User Story 2 - Company Admin Sets Up Category & Department Master Data (Priority: P2)

A Company Admin creates and maintains the list of registrant Categories (e.g., Student, Teaching Staff, Non-Teaching Staff) and academic Departments for their own canteen, so that people registering on their app can accurately identify who they are and which department they belong to.

**Why this priority**: Categories and Departments are prerequisite master data — a Student cannot complete registration (User Story 4) without at least one Category to choose from, and Departments should be available before students register with accurate information. This can be built and demonstrated right after Company/Company Admin creation (User Story 1) and independently of Staff or Student flows.

**Independent Test**: Can be fully tested by having a Company Admin create, edit, and remove Category and Department entries for their own Company, and confirming those entries appear only within that Company's own management screens and dropdowns.

**Acceptance Scenarios**:

1. **Given** a logged-in Company Admin, **When** they create a new Category (e.g., "Student", "Teaching Staff"), **Then** it is saved scoped to their Company and appears in that Company's Category list.
2. **Given** a logged-in Company Admin, **When** they create a new Department (e.g., "Computer Science"), **Then** it is saved scoped to their Company and appears in that Company's Department list.
3. **Given** a Category or Department that is already referenced by an existing Product or User, **When** the Company Admin attempts to remove it, **Then** it is soft-removed (hidden from future selection) while every existing reference to it remains valid and unchanged.
4. **Given** Company A and Company B each have their own Categories and Departments, **When** a Company Admin of Company A views their master data screens, **Then** they see only Company A's entries.

---

### User Story 3 - Company Admin Creates Staff & Peer Admin Accounts (Priority: P2)

A Company Admin creates user accounts for the counter staff who will operate their canteen, and may also create additional Company Admin accounts for their own canteen (e.g., a second administrator), assigning each one the correct role so they can log in.

**Why this priority**: Staff accounts are required before a canteen can operate day-to-day (mark items sold out, verify pickup OTPs), but this can be built and tested independently once a Company and its Company Admin exist.

**Independent Test**: Can be fully tested by having a Company Admin create a Staff user (and separately, a peer Company Admin user) with name, username, temporary password, and email, and confirming each new user can log in with the assigned role and is scoped to the same Company as the creating admin — no order/fulfilment functionality is required to validate this story.

**Acceptance Scenarios**:

1. **Given** a logged-in Company Admin, **When** they create a new Staff account with name, username, temporary password, and email, **Then** a new User record is created with the Staff role and the same `company_id` as the Company Admin.
2. **Given** a logged-in Company Admin, **When** they create a new user and assign the Company Admin role, **Then** a new User record is created with the Company Admin role and the same `company_id`, and that new admin has the same administrative capabilities as the creator.
3. **Given** an existing Staff account, **When** the Company Admin deactivates it, **Then** that account can no longer log in, while its historical activity remains intact.
4. **Given** a username that is already used by another account within the same Company, **When** the Company Admin attempts to create a Staff or Company Admin account with that username, **Then** the creation is rejected with a clear duplicate-username error.
5. **Given** a logged-in Company Admin, **When** they attempt to create a new user with the Student role or the System Admin role, **Then** the creation is rejected — those roles are out of reach of this administrative flow.

---

### User Story 4 - Student Self-Registration (Priority: P3)

A prospective student creates their own account on a specific canteen's app by providing their personal details and selecting their Category and Department, so they can start browsing and ordering food.

**Why this priority**: This is the entry point for the platform's actual end users, but it depends on a Company already existing with its Category/Department master data populated (User Stories 1 and 2), so it is appropriately sequenced after tenant and master-data setup.

**Independent Test**: Can be fully tested by having a prospective student complete the registration form on a given Company's app and confirming a new User record is created with the Student role, scoped to that Company, with the selected Category (and Department, if provided) correctly linked.

**Acceptance Scenarios**:

1. **Given** a Company with at least one active Category, **When** a prospective student submits the registration form with name, username, password, email, and a selected Category, **Then** a new User record is created with the Student role, scoped to that Company, and the student is signed in.
2. **Given** a Company with active Departments configured, **When** a prospective student selects a Department during registration, **Then** that Department is saved on their User record.
3. **Given** a username already registered within the same Company, **When** a prospective student tries to register with that same username, **Then** registration is rejected with a clear duplicate-username error, and they are directed to log in instead.
4. **Given** the same mobile number is already registered as a student at Company A, **When** that same person registers at Company B using the same mobile number as their username, **Then** a separate, independent User account is created under Company B.

---

### User Story 5 - System Admin Platform-Wide Management (Priority: P4)

A System Admin views, and directly creates, edits, or removes, Roles, Categories, and Departments across every Company on the platform, so that platform-wide data quality and governance can be maintained — including correcting or supplementing a tenant's own master data — without contacting engineering.

**Why this priority**: This is a cross-tenant management capability layered on top of the tenant-scoped management already delivered by User Stories 1–3; it adds cross-tenant reach rather than new core capability, so it can be delivered last without blocking earlier value.

**Independent Test**: Can be fully tested by having a System Admin open a platform-wide view listing Roles, Categories, and Departments from multiple Companies at once, directly editing one Company's Category from that view, and confirming the change is reflected in that Company's own tenant-scoped view.

**Acceptance Scenarios**:

1. **Given** multiple Companies each with their own Categories and Departments, **When** a System Admin opens the platform-wide management view, **Then** they can see every Company's Roles, Categories, and Departments in one place, correctly attributed to the right Company.
2. **Given** the platform-wide management view, **When** a System Admin creates, edits, or removes a Category or Department belonging to a specific Company, **Then** the change takes effect for that Company exactly as if its own Company Admin had made it.
3. **Given** a Company Admin, Staff, or Student user attempts to reach the same platform-wide management view, **When** they try to access it, **Then** access is denied — this view is exclusive to the System Admin role.

---

### Edge Cases

- What happens when a Company ends up with more than one Company Admin (via System Admin or peer-admin creation)? (Supported by design — each remains scoped to that single Company with equal administrative capability; see User Story 3.)
- How does the system handle a student attempting to register on a Company whose open/closed status is currently closed? (Registration and login continue to work; the closed status only blocks placing new orders — see Assumptions.)
- What happens when a Category or Department list is empty for a Company at the moment a student tries to register? (Category is a required selection, so registration cannot proceed until the Company Admin has created at least one Category; Department, being optional, does not block registration.)
- How does the system prevent a Company Admin or Staff user from viewing or editing another Company's Categories, Departments, or users, even if they guess or construct a request referencing another Company's identifiers?
- What happens when someone tries to hard-delete a Category or Department that is still referenced by existing Products or Users? (Not permitted — only a soft delete/hide from future selection is allowed.)
- How does the system respond when the same mobile number is used as a username for two separate registration attempts at two different Companies? (Both succeed as independent accounts, since uniqueness is enforced per Company, not platform-wide.)
- What happens when a Company Admin tries to deactivate their own account or the only remaining active Company Admin for their Company?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a System Admin to create a Company record with name, contact person, mobile number, email, and address.
- **FR-002**: System MUST allow a System Admin to view and list every Company on the platform, and to update a Company's details and toggle its open/closed status.
- **FR-002a**: System MUST allow a System Admin to toggle a Company's `is_sms` setting (default `true`), governing whether `specs/014-msg91-sms-otp-mobile-verification`'s registration-time mobile-number verification delivers its code via SMS (MSG91, when `true`) or via FCM push directly (when `false`) — the same update path as FR-002, not a separate capability.
- **FR-003**: System MUST automatically establish a default set of Company-scoped roles (Company Admin, Staff, Student) at the moment a new Company is created, so those roles are immediately available for assigning to that Company's users.
- **FR-004**: System MUST allow a System Admin to create the first user for a newly created Company and assign that user the Company Admin role for it.
- **FR-005**: System MUST allow a System Admin to view, create, update, and remove Roles, Categories, and Departments across every Company on the platform from a single, platform-wide capability.
- **FR-006**: System MUST allow a Company Admin to create, update, and remove (soft-delete) Category records scoped to their own Company only.
- **FR-007**: System MUST allow a Company Admin to create, update, and remove (soft-delete) Department records scoped to their own Company only.
- **FR-008**: System MUST prevent a Category or Department from being permanently deleted while it is referenced by any existing Product or User record; removal MUST only hide it from future selection while preserving existing references unchanged.
- **FR-009**: System MUST allow a Company Admin to create Staff or Company Admin user accounts within their own Company, supplying name, username, a temporary password, and email, and assigning the corresponding role.
- **FR-010**: System MUST allow a Company Admin to activate or deactivate any Staff or Student user account within their own Company.
- **FR-011**: System MUST allow a prospective Student to self-register on a specific Company's app by providing name, username (mobile number), password, email, and selecting a Category; Department selection is optional.
- **FR-012**: System MUST populate the Category and Department choices shown during Student registration using only the requesting Company's own active (non-removed) master data.
- **FR-013**: System MUST enforce username uniqueness within each Company independently — the same username (mobile number) MUST NOT be usable twice within one Company, but MAY be used to register a separate account at a different Company.
- **FR-014**: System MUST reject any attempt to create a User (Staff or Student) with a username that already exists within the same Company, and MUST present a clear, actionable error to whoever is creating the account.
- **FR-015**: System MUST require every created User account to be assigned exactly one Role at the moment of creation.
- **FR-016**: System MUST ensure every Company, Role, Category, Department, and User (other than the System Admin's own account) is associated with exactly one Company, and MUST prevent any actor other than a System Admin from creating, viewing, or modifying a record belonging to a Company other than their own.
- **FR-017**: System MUST record `created_by`, `updated_by`, `created_at`, and `updated_at` for every Company, Role, Category, Department, and User record, and MUST retain a change history for every creation and modification of these records.
- **FR-018**: A Company Admin creating another user MUST NOT be able to grant a role scoped to a different Company or the platform-wide System Admin role.
- **FR-019**: System MUST allow a Company Admin to create new user accounts for their own Company with either the Staff role or the Company Admin role; a Company Admin MUST NOT be able to create a Student account through this administrative flow (Students self-register per User Story 4) and MUST NOT be able to assign the System Admin role.
- **FR-020**: The Category a Student selects during registration MUST represent the registrant's personal affiliation type within the college (e.g., "Student", "Teaching Staff", "Non-Teaching Staff") and is an entity entirely separate and independent from any food-item classification that may later be used for Products.
- **FR-021**: System Admin's platform-wide capability over Roles, Categories, and Departments MUST include full administrative control — System Admin can directly create, update, and remove any Company's Role, Category, or Department records, not merely view them — in addition to the tenant-scoped management each Company Admin performs for their own Company (User Story 2).

### Key Entities

- **Company (Tenant)**: A single college canteen operating independently on the platform. Holds identifying/contact details (name, contact person, mobile, email, address) and an open/closed status that governs whether it currently accepts new orders. Every other entity below (except the System Admin's own account) belongs to exactly one Company.
- **Role**: A named permission group that determines what a User is allowed to do. Four roles exist: System Admin (platform-wide, not tied to any single Company), Company Admin, Staff, and Student (the latter three always scoped to one specific Company). Every User has exactly one Role.
- **Category**: A classification of the type of person registering on a Company's app (e.g., "Student", "Teaching Staff", "Non-Teaching Staff"), scoped to one Company, required during Student registration. Distinct from Role (which governs platform permissions) and independent of any food-item classification that may later be used for Products (out of scope for this feature).
- **Department**: A student's academic department (e.g., "Computer Science") scoped to one Company, offered as an optional selection during Student registration.
- **User**: An account on the platform — a System Admin, Company Admin, Staff member, or Student. Carries identifying details (name, username, email) and, except for the System Admin, belongs to exactly one Company and references one Category and (optionally) one Department when the User is a Student.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A System Admin can fully onboard a new tenant — creating both the Company record and its first Company Admin account — in under 10 minutes of active effort, with zero engineering or code-deployment involvement.
- **SC-002**: A Company Admin can create a new Staff account and have that staff member able to log in within 2 minutes of account creation.
- **SC-003**: A prospective student can complete self-registration, including Category and (where offered) Department selection, in under 2 minutes.
- **SC-004**: 100% of Companies, Roles, Categories, Departments, and Users created on the platform are correctly scoped to exactly one Company, with zero observed instances of one Company's users or master data becoming visible or editable from another Company's context.
- **SC-005**: A newly onboarded Company can independently set up its own Categories, Departments, and Staff, and accept its first Student registration, without any additional platform-level (System Admin or engineering) action beyond the initial tenant onboarding in SC-001.
- **SC-006**: A System Admin can view a consolidated, platform-wide list of every Company's Roles, Categories, and Departments in a single screen/interaction, without needing direct database access.

## Assumptions

- **Department optionality**: Department is an optional field at Student registration; Category is required. This follows the source PRD, which marks Category as required (`*`) and Department as not required.
- **Closed-company behavior**: Toggling a Company's status to closed blocks new order placement only; it does not block existing students from logging in or new students from registering on that Company's app. Only the order-placement flow (out of scope for this feature) enforces the closed check.
- **Fixed role set in V1**: The four roles (System Admin, Company Admin, Staff, Student) are the complete, fixed set for V1. Creating a Company automatically seeds its three tenant-scoped roles; no custom/new role types can be authored by a System Admin or Company Admin in this feature's scope.
- **Soft delete everywhere**: Removing a Category, Department, or deactivating a User never physically deletes the underlying record — it is hidden from future selection/listing while historical references (existing Products, existing Orders, existing account history) remain intact, consistent with the platform's general audit/traceability requirements.
- **Temporary/initial passwords**: Passwords set by a System Admin (for a new Company Admin) or a Company Admin (for a new Staff account) are treated as initial/temporary credentials; how the created user subsequently changes that password is handled by the platform's existing authentication flows and is out of scope for this feature.
