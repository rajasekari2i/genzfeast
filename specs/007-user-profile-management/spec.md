# Feature Specification: User Profile (View, Edit, Change Password)

**Feature Branch**: `007-user-profile-management`

**Created**: 2026-09-05

**Status**: Draft

**Input**: User description: "GenzFeast is a multi-tenant (multi-company) mobile food ordering platform that connects college canteens (\"companies\"/tenants) with students on their campus. Each canteen operates as an independent tenant with its own staff, products, and orders, while a central System Admin governs onboarding and platform-wide oversight. Analyse the BRD, PRD, Architecture, and UI Design docs and spec the Profile page for all the users."

**Scope note**: The source PRD only specifies a Profile screen for the Student role (FR-10). Since the request explicitly asks for a Profile page "for all the users," this spec generalizes that same view/edit/change-password pattern to every role (System Admin, Company Admin, Staff, Student), showing only the fields that actually apply to each — see Assumptions. The Logout action shown on the Profile screen reuses the capability already fully specified in `002-registration-login-jwt-auth` and is not redefined here.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View My Profile (Priority: P1)

Any logged-in user opens their Profile screen to see their own account details at a glance.

**Why this priority**: This is the simplest, most foundational piece — every other capability in this feature (editing, changing password) is reached from this same screen, and it delivers value entirely on its own.

**Independent Test**: Can be fully tested by logging in as each role and confirming the Profile screen shows that account's own Name, Username, and Email, plus the role-appropriate extra context (Category/Department for a Student; Company for a Company Admin or Staff member).

**Acceptance Scenarios**:

1. **Given** a logged-in user of any role, **When** they open their Profile screen, **Then** they see their own Name, Username, and Email.
2. **Given** a logged-in Student, **When** they view their Profile, **Then** they additionally see their Category and their Department (shown as unset if none was provided at registration).
3. **Given** a logged-in Company Admin or Staff member, **When** they view their Profile, **Then** they additionally see which Company they belong to.
4. **Given** any user's Profile screen, **When** they look at the Username field, **Then** it is presented as read-only, visually distinct from editable fields.

---

### User Story 2 - Edit My Profile (Priority: P1)

A user updates their own contact details — their Email, and for a Student, their Department — directly from their Profile.

**Why this priority**: This is the core reason a Profile screen exists beyond a read-only display — people's email addresses and department affiliations change, and this is the only way for a user to correct that themselves rather than asking an admin.

**Independent Test**: Can be fully tested by submitting a new, validly formatted Email (and, for a Student, a different Department) and confirming both the stored record and the Profile view reflect the change, while Username and (for a Student) Category remain untouched.

**Acceptance Scenarios**:

1. **Given** a user on their Edit Profile screen, **When** they submit a validly formatted new Email, **Then** it is saved and reflected the next time they view their Profile.
2. **Given** a Student on their Edit Profile screen, **When** they select a different Department from their own Company's list, **Then** it is saved and reflected afterward.
3. **Given** a user submitting an Email in an invalid format, **When** they try to save, **Then** the system rejects it with a clear, field-specific error and saves nothing.
4. **Given** an Edit Profile submission that fails for any reason, **When** the failure occurs, **Then** none of the submitted changes are saved — the update is all-or-nothing, never partial.
5. **Given** any user's Edit Profile screen, **When** they look for a way to change their Name or Username, **Then** no such option exists there — those fields are shown for context only, never editable.

---

### User Story 3 - Change My Password (Priority: P1)

A logged-in user changes their own password by confirming their current one and providing a new one, without going through the separate forgot-password recovery flow.

**Why this priority**: A direct, in-session password change is a baseline account-security expectation, independent of and complementary to the forgot-password recovery flow (`003-forgot-password-otp-reset`), which exists for when a user is locked *out* rather than already logged in.

**Independent Test**: Can be fully tested by submitting the correct current password with a new password (and matching confirmation), then confirming the account's password is updated and a subsequent login with the new password succeeds.

**Acceptance Scenarios**:

1. **Given** a logged-in user, **When** they submit their correct current password along with a new password and a matching confirmation, **Then** their password is updated.
2. **Given** a successful password change, **When** the system checks that account's other sessions afterward, **Then** every one of them has been ended, other than the session that performed the change.
3. **Given** a user submitting a new password and confirmation that don't match each other, **When** they try to save, **Then** the system rejects the submission without even checking the current password.
4. **Given** a user submitting an incorrect current password, **When** they try to save, **Then** the system rejects it with a clear inline error, changes nothing, and lets them retry.

---

### Edge Cases

- What happens when a Student submits a Department that doesn't belong to their own Company? (Rejected — Department choices are limited to the student's own Company's master data, consistent with `001-company-role-user-setup`'s tenant isolation.)
- What happens when a non-Student role's edit submission includes a Category or Department value? (Ignored/rejected — those fields don't apply to and cannot be set for any role other than Student.)
- What happens when a user changes their password to the exact same value as their current one? (Allowed — nothing in the platform's source documents restricts password reuse.)
- What happens to a user's other active sessions if their Email or Department is updated (not their password)? (Unaffected — only a password change triggers other-session revocation, per User Story 3.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow any authenticated user to view their own profile, showing at least their Name, Username, and Email.
- **FR-002**: The profile view MUST additionally show role-appropriate context: Category and Department for a Student; the Company they belong to for a Company Admin or Staff member; nothing further for a System Admin.
- **FR-003**: Username MUST always be presented as read-only on the profile view and MUST NOT be changeable through any action in this feature, for any role.
- **FR-004**: System MUST allow any authenticated user to update their own Email from their profile.
- **FR-005**: System MUST additionally allow a Student to update their own Department; a Student's Category MUST remain read-only and unchangeable once set at registration.
- **FR-006**: System MUST validate a submitted Email's format before saving, and MUST reject an invalid submission with a clear, field-specific error, saving nothing.
- **FR-007**: A profile edit MUST be all-or-nothing — if it fails for any reason, none of the submitted field changes are saved.
- **FR-008**: Name MUST always be presented as read-only on the profile view, exactly like Username, and MUST NOT be changeable through any action in this feature, for any role.
- **FR-009**: System MUST allow any authenticated user to change their own password by submitting their current password, a new password, and a repeated confirmation of the new password.
- **FR-010**: System MUST reject a password-change submission whose new password and its confirmation do not match, without evaluating the current password at all.
- **FR-011**: System MUST reject a password-change submission whose stated current password does not match the account's actual password, with a clear inline error, changing nothing, and allowing the user to retry.
- **FR-012**: On a successful password change, System MUST update the account's password and MUST revoke every other currently active session for that account, other than the session that performed the change (consistent with `002-registration-login-jwt-auth`'s session-revocation mechanics).
- **FR-013**: System MUST record every profile update and password change in a manner that supports later auditing, consistent with the platform's general auditability requirements.
- **FR-014**: System MUST prevent any user from viewing or editing another user's profile — every action in this feature operates only on the caller's own account.

### Key Entities

- **User Profile**: Not a new entity — a role-aware view over the existing User record (`001-company-role-user-setup`), exposing Name, Username, Email, and, where applicable, Category, Department, or Company, together with the actions to edit the editable subset of those fields and to change the account's password.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Any user can view their own current profile information in a single screen, with no additional navigation required.
- **SC-002**: A user can successfully update their Email (and Department, for a Student) in a single submission.
- **SC-003**: 100% of profile updates leave Username, and — for a Student — Category, unchanged; zero cases of either being altered through this feature.
- **SC-004**: 100% of successful password changes result in every other previously active session for that account losing the ability to make further authenticated requests.
- **SC-005**: 100% of invalid-email or incorrect-current-password submissions are rejected with zero partial saves.

## Assumptions

- **Name is read-only**: Resolved via clarification — Name is locked after registration/creation, exactly like Username; only Email (all roles) and Department (Student only) are ever editable (FR-008).
- **Generalized to every role**: The source PRD (FR-10) specifies this Profile pattern for Students only. Per the explicit request to spec it "for all the users," this feature extends the same view/edit/change-password capability to System Admin, Company Admin, and Staff as well, each seeing only the fields relevant to their own account (FR-002).
- **No email verification step**: Updating Email takes effect immediately; nothing in the platform's source documents describes an email-confirmation/verification mechanism anywhere, so none is introduced here.
- **Category is permanently fixed after registration**: Only Department and Email are ever editable on the profile (FR-005); Category is not listed as editable anywhere in the source PRD's profile requirements.
- **Logout is out of scope here**: The Profile screen surfaces a Logout action per the UI Design document, but that capability is fully specified in `002-registration-login-jwt-auth` and is not redefined by this feature.
- **Change Password is distinct from Forgot Password**: This feature's password-change action requires the user to already be logged in and know their current password; the separate, OTP-based recovery path for a user who cannot log in at all remains owned by `003-forgot-password-otp-reset`.
