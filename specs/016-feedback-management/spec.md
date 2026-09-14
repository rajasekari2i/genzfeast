# Feature Specification: Feedback Management

**Feature Branch**: `016-feedback-management`

**Created**: 2026-09-14

**Status**: Draft

**Input**: User description: "I am planning to create a Feedback Page for my mobile application. This should visible for all the roles. this page also tenant-specific, if feedback table should have company_id, if the user entering details that should be stored in the feedback table with the company_id. Company_admin should have a seprate page to verify all the feedback and should have a status to resolve, if the user creating feedback (new status), company_admin verify and make it resolve. Feedback page content: Rating (1-5 stars, optional), Category (dropdown: App Experience, Food/Order Quality, Payment Issue, Pickup Experience, Suggestion, Other), Message (free text), Contact me back (checkbox, shows registered email read-only if checked), Submit (success message + link back to Home)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Submit Feedback About the Canteen (Priority: P1)

Any signed-in user of a tenant's app — Student, Teaching, Non-Teaching, Company Staff, or Company Admin — wants to tell their canteen what's working and what isn't: a star rating, a category, and a free-text message, with an option to be contacted back at their registered email. They submit it and get a clear confirmation that their canteen received it.

**Why this priority**: This is the entire reason the feature exists — capturing tenant-scoped feedback. Without this, there is nothing for a Company Admin to review. It is also independently valuable: even with no admin review screen yet, feedback is durably captured and available for manual/ops follow-up.

**Independent Test**: Can be fully tested by having a user of any in-scope role open the Feedback page, fill in Category and Message (optionally Rating and "Contact me back"), and tap Submit — and verifying a feedback record is created, correctly tagged with that user's own company, with a `new` status and a success confirmation shown to the user.

**Acceptance Scenarios**:

1. **Given** a signed-in Student on their canteen's app, **When** they open the Feedback page, select a Category, enter a Message, and tap Submit, **Then** a feedback record is created with `status = new`, tagged with the Student's `company_id`, and the app shows "Thanks! Your feedback helps us improve {Tenant Company Name}." with a way back to Home.
2. **Given** the Feedback page is open, **When** the user selects a 1–5 star Rating before submitting, **Then** the rating is stored with the feedback record.
3. **Given** the Feedback page is open, **When** the user submits without selecting a Rating, **Then** the submission still succeeds and the feedback record has no rating value.
4. **Given** the Feedback page is open, **When** the user checks "Contact me back," **Then** their registered email is shown read-only on the form (not re-entered) and the submitted record is flagged as requesting contact.
5. **Given** the Feedback page is open, **When** the user taps Submit without selecting a Category or without entering a Message, **Then** the submission is blocked and the missing field(s) are called out inline.
6. **Given** a user belongs to Company A's app, **When** they submit feedback, **Then** the record is tagged with Company A's `company_id` and is never visible to any other company's admin.

---

### User Story 2 - Company Admin Reviews Incoming Feedback (Priority: P2)

A Company Admin wants a single place to see all the feedback students, teaching/non-teaching staff, and their own staff have submitted for their canteen, so nothing gets missed.

**Why this priority**: Capturing feedback (US1) only creates business value once someone at the canteen can actually see and act on it. This is the next-most-critical slice after capture.

**Independent Test**: Can be fully tested by seeding several feedback records for a company (mixing statuses, categories, ratings) and verifying the Company Admin's review page lists only that company's records, shows each record's rating/category/message/contact-request/status, and lets the admin filter by status.

**Acceptance Scenarios**:

1. **Given** a Company Admin opens the feedback review page, **When** the page loads, **Then** it lists only feedback submitted by users of their own company, newest first.
2. **Given** the review list is open, **When** the admin filters by status "New," **Then** only unresolved feedback is shown.
3. **Given** a feedback item has "Contact me back" checked, **When** the admin opens its detail, **Then** the submitter's registered email is visible on that detail view.
4. **Given** a Company Admin from Company A is signed in, **When** they open the review page, **Then** they cannot see or retrieve any feedback belonging to Company B, even by direct reference.

---

### User Story 3 - Company Admin Resolves Feedback (Priority: P3)

Having reviewed a feedback item, the Company Admin marks it handled so the review queue reflects real, current outstanding work.

**Why this priority**: Completes the feedback loop started by US1/US2. Lower priority than being able to see feedback at all, but is the step that gives the review queue lasting value instead of becoming a write-only log.

**Independent Test**: Can be fully tested by opening a `new` feedback item as Company Admin, marking it resolved, and verifying its status changes to `resolved` and it reflects that state in the list/filters.

**Acceptance Scenarios**:

1. **Given** a feedback item with `status = new`, **When** the Company Admin marks it resolved, **Then** its status becomes `resolved` and it no longer appears under the "New" filter.
2. **Given** a feedback item already `resolved`, **When** the admin views the list filtered to "Resolved," **Then** that item appears there.
3. **Given** a non-admin role (Student, Teaching, Non-Teaching, Company Staff) attempts to change a feedback item's status, **When** the action is attempted, **Then** it is rejected — only Company Admin can resolve feedback.

---

### Edge Cases

- What happens if the user submits with neither a Rating nor "Contact me back" checked, only Category + Message? Submission succeeds — Rating and "Contact me back" are both optional.
- What happens if the user's Message is empty or only whitespace? Submission is blocked with an inline validation message (Message is required).
- What happens if the user picks no Category? Submission is blocked with an inline validation message (Category is required; "Other" exists precisely so a value can always be chosen).
- What happens if the canteen is currently closed (`is_open = false`)? Feedback submission is still allowed — it is not gated by whether the canteen is currently accepting orders.
- What happens if a user holds separate accounts at two different companies (per platform's per-tenant registration model)? Each feedback submission is tagged with the `company_id` of whichever tenant app/session the user is actively signed into at submission time — never both.
- How does the system handle a Company Admin trying to view or resolve a feedback record belonging to another company (e.g., by guessing/tampering with an ID)? The request is rejected/not found — tenant isolation applies to feedback exactly as it does to every other tenant-scoped table.
- What happens if "Contact me back" is checked but the user's on-file email is missing or unverified? The checkbox and read-only email field still display whatever value is on file (per FR-10, email is a required profile field, so an empty value is not expected); no additional email-verification gate blocks submission.
- What happens once a feedback item is marked `resolved` — can it be reopened? Not in V1: resolution is a one-way transition (see Assumptions).
- What happens if the same user submits multiple feedback items over time? Each submission is stored as its own independent record; there is no cap or de-duplication in V1.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a Feedback page reachable by any signed-in user of a tenant's app, regardless of role (Student, Teaching, Non-Teaching, Company Staff, Company Admin).
- **FR-002**: The Feedback page MUST let the user optionally choose a star Rating from 1 to 5.
- **FR-003**: The Feedback page MUST require the user to choose exactly one Category from a fixed list: App Experience, Food/Order Quality, Payment Issue, Pickup Experience, Suggestion, Other.
- **FR-004**: The Feedback page MUST require the user to enter a free-text Message describing their feedback, and MUST display prompt copy that names their own tenant (e.g., "Tell us more — what happened, or what would make {Tenant Company Name} better?").
- **FR-005**: The Feedback page MUST provide a "Contact me back" checkbox; when checked, it MUST display the user's already-registered email as read-only (the user is never asked to re-enter contact information they've already provided).
- **FR-006**: On Submit, the system MUST persist a feedback record containing the Rating (if provided), Category, Message, whether contact-back was requested, the submitting user's identity, and the `company_id` of the tenant the submitting user is currently scoped to.
- **FR-007**: The system MUST reject a Submit attempt that is missing Category or Message, with an inline indication of what's missing, and MUST NOT create a feedback record for a rejected attempt.
- **FR-008**: On a successful submission, the system MUST show a confirmation message that names the tenant (e.g., "Thanks! Your feedback helps us improve {Tenant Company Name}.") and MUST offer a way back to the Home screen — the confirmation MUST NOT be a dead end.
- **FR-009**: Every feedback record MUST start in a `new` status at creation and MUST NOT be creatable in any other status.
- **FR-010**: The system MUST provide a separate feedback review page, accessible only to the Company Admin role, listing feedback records belonging strictly to that admin's own company.
- **FR-011**: The feedback review page MUST let the Company Admin filter the list by status (`new` / `resolved`) at minimum.
- **FR-012**: The feedback review page MUST show, per record, its Rating (if any), Category, Message, whether contact-back was requested, current status, and — when contact-back was requested — the submitter's registered email.
- **FR-013**: The system MUST let a Company Admin change a feedback record's status from `new` to `resolved`.
- **FR-014**: The system MUST prevent any role other than Company Admin from changing a feedback record's status.
- **FR-015**: The system MUST enforce that a feedback record is only ever visible to, filterable by, or modifiable by users belonging to the same company that record is tagged with, at both the API layer (scoping every query by the caller's own `company_id` from their verified session) and the database layer (row-level policy), matching this platform's existing multi-tenant isolation model — a bug at either layer alone must never be sufficient to leak one company's feedback to another.
- **FR-016**: The system MUST record standard audit fields (who created the record, who last updated it, and when) on every feedback record and its status change, consistent with this platform's existing auditability convention.
- **FR-017**: The system MUST soft-delete feedback records if ever removed (never a hard delete), consistent with this platform's existing data convention.

### Key Entities

- **Feedback**: A single piece of tenant-scoped input submitted by one user about their canteen. Attributes: optional star Rating (1–5), Category (one of the fixed set), Message (free text), a "wants contact back" flag, current Status (`new` or `resolved`), the `company_id` it belongs to, and a reference to the submitting user. Relationships: belongs to exactly one Company (tenant); belongs to exactly one submitting User; a Company Admin (of the same company) may transition its Status.
- **Feedback Category**: The fixed set of classification values a submitter chooses from — App Experience, Food/Order Quality, Payment Issue, Pickup Experience, Suggestion, Other. Not the same concept as the platform's existing per-tenant "Category" master data used at Student registration (affiliation type) — this is a feedback-specific classification list, unrelated and not user-manageable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can complete and submit feedback (Category + Message, optionally Rating and contact-back) in under 60 seconds from opening the page.
- **SC-002**: 100% of submitted feedback records are attributed to the submitter's own company, with zero cross-tenant visibility of feedback in manual or automated testing.
- **SC-003**: A Company Admin can find all of their canteen's currently-unresolved feedback (filtered view) and open any one item's full detail in 2 or fewer taps from the review page.
- **SC-004**: A Company Admin can mark a feedback item resolved in 1 tap from its detail view, and the change is reflected in the list immediately.
- **SC-005**: For every feedback item where contact-back was requested, the Company Admin can see the submitter's registered email without leaving the review page's detail view.
- **SC-006**: Submitting feedback never blocks or interferes with any other in-app action (browsing, ordering, order pickup) — it is reachable and usable independently of order state.

## Assumptions

- "Visible for all the roles" is read as: all roles that belong to a specific tenant and use that tenant's mobile app — Student, Teaching, Non-Teaching, Company Staff, and Company Admin. `system_admin` is excluded because that role is platform-wide with no `company_id` (per this platform's global-roles model) and does not fit a tenant-scoped feedback record; System Admin has no feedback-page surface in this feature.
- A Company Admin submitting feedback about their own canteen is treated the same as any other role's submission (same record shape, same review queue) — there is no special-casing.
- The feedback lifecycle in V1 is a simple two-state model: `new` → `resolved`. There is no intermediate "in review"/"in progress" state and no reopening a `resolved` item back to `new` — matches the user's explicit description of exactly these two states.
- Company Staff can submit feedback (per FR-001) but does **not** get access to the review/resolve page — that page is Company Admin-only, per the user's explicit description ("Company_admin should have a separate page to verify all the feedback").
- Feedback records are never anonymous to the Company Admin — the submitting user's identity is always attached to the record for accountability and audit purposes (consistent with this platform's blanket `created_by`/audit-log convention), independent of whether "Contact me back" is checked. The checkbox only controls whether the submitter is additionally signaling they'd like to be proactively contacted; it does not hide identity either way.
- "Contact me back" surfaces the submitter's already-registered email to the Company Admin for manual follow-up (e.g., a phone call, an in-person conversation, or a reply through some other existing channel); it does **not** trigger any automated email or push notification back to the submitter, since no outbound-email channel exists in this platform's current architecture (push notifications are FCM-only, addressed by device token, not email).
- Once submitted, a feedback record cannot be edited or withdrawn by the submitter, and V1 does not provide the submitter any screen to see the status of feedback they've previously submitted — the submission flow is fire-and-forget from the submitter's perspective (matching the "no dead-end, maybe a link back to Home" framing in the source description, rather than a link into a personal feedback history).
- There is no rate limit or duplicate-submission prevention in V1 — a user may submit any number of separate feedback items over time.
- Feedback submission is available regardless of the canteen's open/closed (`is_open`) state — it is not an order-adjacent action and is not gated by whether the canteen is currently accepting orders.
- Message has a reasonable maximum length (matching typical free-text feedback fields, e.g. on the order of a few hundred to ~1000 characters) to keep records readable and storage bounded; the exact limit is a planning-level detail, not a business rule.
