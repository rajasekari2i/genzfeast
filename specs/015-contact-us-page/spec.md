# Feature Specification: Contact Us Page

**Feature Branch**: `015-contact-us-page`

**Created**: 2026-09-14

**Status**: Draft

**Input**: User description: "I am planning to create a contact us page for my mobile application. This should visible for all the roles. This page has two natural audiences for a multi-tenant canteen app. Each tenant we need a different page. System admin should have a separate page to master data the 'contact us page details' tenant based. When company admin, company staff, student, non_teaching, teaching login to our application, we need show to contact us page. Contact us page content: Contact Person, Phone Number, email, Address, Operating Hours (if you add this field — not currently in your Data Model, worth considering)."

**Scope note**: This feature has two independently testable halves: (1) a read-only Contact Us screen shown to every logged-in tenant role (Company Admin, Company Staff, Student, Teaching, Non-Teaching), scoped to that user's own company; and (2) a System Admin surface to master the Contact Us details per company, platform-wide. System Admin is a manager of this data, not a viewer of a Contact Us page themselves — the source request lists only the five tenant-side roles as consumers of the read-only page.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View My Canteen's Contact Us Info (Priority: P1)

A logged-in Company Admin, Company Staff, Student, Teaching, or Non-Teaching user opens Contact Us from the app's navigation and sees how to reach their own canteen: Contact Person, Phone Number, Email, Address, and Operating Hours.

**Why this priority**: This is the entire reason the feature exists — a way for any tenant member to find out who to contact and how. It delivers complete value on its own, independent of who manages the underlying data.

**Independent Test**: Can be fully tested by logging in as each of the five tenant roles and confirming the Contact Us screen shows that user's own company's Contact Person, Phone Number, Email, Address, and Operating Hours (or a clear "not specified" indicator where Operating Hours hasn't been set).

**Acceptance Scenarios**:

1. **Given** a logged-in user of any tenant role (Company Admin, Company Staff, Student, Teaching, Non-Teaching), **When** they open Contact Us, **Then** they see their own company's Contact Person, Phone Number, Email, and Address.
2. **Given** a company whose System Admin has set Operating Hours, **When** a tenant user opens Contact Us, **Then** the Operating Hours are shown alongside the other details.
3. **Given** a company whose Operating Hours has never been set, **When** a tenant user opens Contact Us, **Then** the screen shows a clear "not specified" indicator for that field instead of a blank or broken layout.
4. **Given** a company currently closed (`is_open = false`), **When** a tenant user of that company opens Contact Us, **Then** the same contact details are shown unchanged — closing the canteen for new orders does not hide how to reach it.
5. **Given** a logged-in tenant user, **When** they look at their own Contact Us screen, **Then** no edit action is available anywhere on it.

---

### User Story 2 - System Admin Masters Contact Us Details Per Company (Priority: P1)

A System Admin selects a company and views/edits that company's Contact Us details — Contact Person, Phone Number, Email, Address, and Operating Hours — from a dedicated Contact Us management screen, separate from the existing company onboarding screen.

**Why this priority**: Without this, User Story 1 has nothing to display — someone has to be able to set and correct this per-tenant data, and the request is explicit that only System Admin does so.

**Independent Test**: Can be fully tested by logging in as System Admin, selecting a company, submitting new Contact Us values, and confirming both the System Admin screen and that company's tenant-facing Contact Us screen (User Story 1) reflect the change afterward.

**Acceptance Scenarios**:

1. **Given** a logged-in System Admin, **When** they select a company from the company list, **Then** they can open a Contact Us management screen showing that company's current Contact Person, Phone Number, Email, Address, and Operating Hours.
2. **Given** the System Admin's Contact Us management screen, **When** they submit valid new values, **Then** the company's Contact Us record is updated and reflected the next time any tenant user of that company views Contact Us — no re-login required.
3. **Given** a System Admin submission with an invalid Email or Phone Number format, **When** they try to save, **Then** the system rejects it with a clear, field-specific error and saves nothing.
4. **Given** a System Admin submission that fails for any reason, **When** the failure occurs, **Then** none of the submitted field changes are saved — the update is all-or-nothing, never partial.
5. **Given** a System Admin managing Contact Us for Company A, **When** they view or edit it, **Then** only Company A's record is affected — no other company's Contact Us details change.

---

### User Story 3 - Quick-Contact Actions (Priority: P2)

A tenant user viewing Contact Us taps the phone number to start a call, or taps the email address to compose an email, without having to copy the value manually.

**Why this priority**: This turns a static information screen into something people actually act on in the moment they need it (e.g., calling the canteen about an order). It's valuable but the page is still fully usable — just less convenient — without it, so it ranks below the two P1 stories.

**Independent Test**: Can be fully tested by opening Contact Us as any tenant role, tapping the phone number, and confirming the device offers to place a call to that exact number; separately tapping the email and confirming the device offers to compose a message to that exact address.

**Acceptance Scenarios**:

1. **Given** a tenant user on the Contact Us screen, **When** they tap the Phone Number, **Then** their device offers to initiate a call to that number.
2. **Given** a tenant user on the Contact Us screen, **When** they tap the Email, **Then** their device offers to compose a message to that address.
3. **Given** a tenant user on the Contact Us screen, **When** they look at the Address, **Then** it is shown as plain text (no map or navigation action is offered).

---

### Edge Cases

- What happens when a tenant user's company has no Operating Hours set? Shown as "not specified" (User Story 1, Scenario 3); Contact Person/Phone/Email/Address are always present since they are required at company creation (`001-company-role-user-setup`).
- What happens when a Company Admin, Staff, Student, Teaching, or Non-Teaching user attempts to reach the System Admin's Contact Us management screen or its underlying edit action directly? Rejected — editing is restricted to System Admin only, for any company, including the caller's own.
- What happens when a System Admin views Contact Us for a company that was only just created (default values)? Contact Person/Phone/Email/Address show the values captured at company creation; Operating Hours shows "not specified" until a System Admin sets it.
- What happens if a tenant user's company is soft-deleted? Not applicable within this feature — a user's session and access are already scoped to their own active company by the platform's existing tenant-isolation rules; this feature introduces no new behavior for that case.
- What happens when the phone number or email on file is malformed from old/legacy data? Not expected — both fields are validated on every System Admin save (User Story 2, Scenario 3); no unvalidated path exists to introduce a malformed value.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST let any authenticated Company Admin, Company Staff, Student, Teaching, or Non-Teaching user view a read-only Contact Us screen for their own company, showing Contact Person, Phone Number, Email, Address, and Operating Hours.
- **FR-002**: The Contact Us view MUST be scoped strictly to the caller's own company — a tenant user MUST NOT be able to view another company's Contact Us details through any action in this feature.
- **FR-003**: System MUST let a System Admin view and edit Contact Us details (Contact Person, Phone Number, Email, Address, Operating Hours) for any company, platform-wide, via a dedicated Contact Us management screen distinct from the company onboarding/edit screen.
- **FR-004**: Only the System Admin role MAY edit Contact Us details; Company Admin, Company Staff, Student, Teaching, and Non-Teaching MUST have read-only access, with no edit action exposed anywhere in their app surfaces — including for their own company.
- **FR-005**: Operating Hours MUST be an optional field; when unset for a company, System MUST show a clear "not specified" indicator to tenant viewers rather than a blank or broken field.
- **FR-006**: Contact Person, Phone Number, Email, and Address MUST remain required (non-empty) at all times, consistent with these fields already being required when a company is first created.
- **FR-007**: System MUST validate Email format and Phone Number format on every System Admin save, and MUST reject an invalid submission with a clear, field-specific error, saving nothing.
- **FR-008**: A System Admin's Contact Us update MUST be all-or-nothing — if it fails for any reason, none of the submitted field changes are saved.
- **FR-009**: A company's Contact Us content MUST remain visible to that company's users regardless of the company's open/closed status.
- **FR-010**: Tapping the Phone Number on the Contact Us screen MUST offer to initiate a call to that number; tapping the Email MUST offer to compose a message to that address; the Address MUST be shown as plain text with no map/navigation action.
- **FR-011**: Every System Admin edit to a company's Contact Us details MUST be attributable (who, when) and auditable, consistent with the platform's general auditability rule for business-critical data.
- **FR-012**: The Contact Us screen MUST be reachable from each tenant role's primary in-app navigation, without requiring any additional lookup or re-login.

### Key Entities

- **Company Contact Us Info**: Not a new entity — an extension of the existing Company record (`001-company-role-user-setup`). Contact Person, Phone Number, Email, and Address already exist as required fields on that record; this feature adds one new optional attribute, Operating Hours, and surfaces all five fields read-only to every member of that company while keeping edit access limited to System Admin, exactly as the company's core record already is.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Any tenant user (Company Admin, Company Staff, Student, Teaching, Non-Teaching) can reach their canteen's Contact Us information within 2 taps from the app's home screen.
- **SC-002**: A System Admin can update a company's Contact Us details in a single form submission, with the change visible to that company's tenant users on their very next view of the screen — no re-login required.
- **SC-003**: 100% of Contact Us views return only the viewer's own company's data; zero instances of a tenant user seeing another company's Contact Us details.
- **SC-004**: 100% of System Admin Contact Us submissions with an invalid Email or Phone Number format are rejected, with zero partial saves.
- **SC-005**: 100% of Contact Us screens with a set Phone Number or Email offer a working tap-to-call or tap-to-email action for that field.

## Assumptions

- **Reuses the existing Company record rather than a new entity**: Contact Person, Phone Number (`mobile`), Email, and Address already exist as required fields on the Company record established in `001-company-role-user-setup`. This feature adds one new optional attribute (Operating Hours) to that same record instead of introducing a parallel, near-duplicate set of fields.
- **Edit rights are System-Admin-only**: This mirrors the existing pattern where only System Admin creates/edits a company's core record (PRD FR-1.1, FR-1.3); Company Admin is not granted edit access here since the source request describes only System Admin as "mastering" this data, and no other GenzFeast spec currently gives Company Admin write access to their own company's core record.
- **Operating Hours is a single free-text field** (e.g., "Mon–Sat, 9:00 AM – 8:00 PM"), not a structured per-day schedule — consistent with how every other Company field (Address, Contact Person) is already free text, and nothing in the source documents calls for day-by-day granularity.
- **Pre-login access is out of scope**: The source request frames this feature entirely around authenticated users ("When company admin, company staff, student ... login to our application, we need show the contact us page"). An unauthenticated Contact Us surface (e.g., reachable from the Login or Forgot Password screen) is not requested and is left for a future feature if needed.
- **System Admin is not a Contact Us viewer**: The source request names only Company Admin, Company Staff, Student, Teaching, and Non-Teaching as consumers of the read-only page; System Admin's role here is limited to managing the data, per its existing platform-wide, cross-tenant management pattern for Categories/Departments/Companies.
- **No map/location integration**: Address is shown as plain text only; opening a maps app from the Address field is not included. Tap-to-call and tap-to-email are included because they rely on native device capability already assumed available on any phone running this app, with no additional integration.
- **Isolation mechanism unchanged**: Both the tenant-scoped read-only view and the System Admin's cross-tenant edit reuse the platform's existing JWT-derived `company_id` scoping and Postgres RLS pattern (Architecture §6) — no new isolation mechanism is introduced by this feature.
