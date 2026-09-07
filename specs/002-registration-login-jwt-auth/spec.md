# Feature Specification: Registration & Login with JWT Authentication

**Feature Branch**: `002-registration-login-jwt-auth`

**Created**: 2026-09-05

**Status**: Draft

**Input**: User description: "GenzFeast is a multi-tenant (multi-company) mobile food ordering platform that connects college canteens (\"companies\"/tenants) with students on their campus. Each canteen operates as an independent tenant with its own staff, products, and orders, while a central System Admin governs onboarding and platform-wide oversight. Analyse the BRD, PRD, Architecture, and UI Design docs and spec the registration & login JWT authentication."

## Clarifications

### Session 2026-09-06

- Q: `username` (mobile number) is unique per Company only — the same mobile number can hold independent accounts at two different Companies (see `001-company-role-user-setup`). `/auth/login` as originally contracted takes only `username` + `password`, with no way to pick which Company's account to authenticate against. How should login resolve this? → A: Add `company_id` to the login request. Each per-tenant branded mobile build sends its own `company_id` alongside `username`/`password`; `system_admin` login omits it (that role's `company_id` is always `NULL`).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Student Registration Starts an Authenticated Session (Priority: P1)

A prospective student who has just completed registration on their canteen's app is taken straight into the app, signed in, without having to separately type their credentials into a login screen.

**Why this priority**: This is the very first authenticated experience a new end-user has on the platform; a registration that doesn't lead straight into a working, signed-in session is a broken first impression and directly blocks every other student-facing feature.

**Independent Test**: Can be fully tested by completing registration (account creation itself is covered by `001-company-role-user-setup`) and confirming the response includes a usable session, and that an immediate authenticated request (e.g., fetching the student's own profile) succeeds without any separate login call.

**Acceptance Scenarios**:

1. **Given** a prospective student has submitted a valid registration form, **When** their account is created, **Then** the system immediately issues them an authenticated session (an access credential and a longer-lived renewal credential) without requiring a separate login step.
2. **Given** a freshly registered student holding their new session, **When** they make their very next request (e.g., loading the product list), **Then** the request succeeds and is correctly scoped to their own Company and Student role, with no additional sign-in prompt.

---

### User Story 2 - Returning User Logs In (Priority: P1)

Any existing user — System Admin, Company Admin, Staff, or Student — returns to the app and signs in with their username and password to resume using the platform.

**Why this priority**: Login is the single most frequently exercised flow on the platform and is a hard prerequisite for every other feature across every role; nothing else can be demonstrated without it.

**Independent Test**: Can be fully tested by submitting correct credentials for an existing account of any role and confirming an authenticated session is issued and usable, and by submitting incorrect credentials and confirming access is denied with no session issued.

**Acceptance Scenarios**:

1. **Given** an existing, active account, **When** the user submits the correct username and password, **Then** they receive a working authenticated session and can immediately make authorized requests scoped to their own role and Company.
2. **Given** an existing account, **When** the user submits an incorrect password or a username that does not exist, **Then** the system rejects the attempt with a single generic error that does not reveal whether the username or the password was the problem.
3. **Given** a user has just logged in successfully, **When** the system checks their record, **Then** their consecutive-failed-login counter has been reset to zero.
4. **Given** a Company that is currently closed for ordering, **When** a Student of that Company logs in, **Then** login still succeeds — the closed status affects order placement only, not authentication (see `001-company-role-user-setup` Assumptions).

---

### User Story 3 - Session Stays Active Without Re-Entering Credentials (Priority: P2)

A signed-in user continues using the app across a normal session — well beyond the lifetime of their short-lived access credential — without ever noticing a re-authentication happen in the background.

**Why this priority**: Without this, every user would be forced to log in again every time their short-lived access credential expires (as often as every 15–60 minutes), which would make the app unusable for any real session. It depends on Login (User Story 2) already existing.

**Independent Test**: Can be fully tested by obtaining a session, waiting for (or simulating) the access credential's expiry, and confirming that presenting the renewal credential alone yields a new working access credential with no username/password re-entry.

**Acceptance Scenarios**:

1. **Given** a signed-in user whose access credential has expired but whose renewal credential is still valid and unrevoked, **When** the client presents the renewal credential, **Then** the system issues a new access credential without asking for username/password again.
2. **Given** a renewal credential that has expired or been revoked, **When** the client attempts to use it, **Then** the system rejects the renewal and the user must log in again with their credentials.
3. **Given** a user is signed in on two different devices at once, **When** each device independently renews its session, **Then** both sessions continue to work independently of one another.

---

### User Story 4 - Repeated Failed Logins Protect the Account (Priority: P2)

Someone repeatedly guessing a user's password is stopped after a limited number of consecutive failures, protecting the account from brute-force attempts.

**Why this priority**: This is a security control, not a feature the product depends on functionally — it can be added after the core login/session flows (User Stories 1–3) are working, but before launch, since it protects real user accounts.

**Independent Test**: Can be fully tested by submitting incorrect passwords for the same account repeatedly and confirming the account becomes locked at the defined threshold, and that a subsequent attempt with the *correct* password is still rejected while locked.

**Acceptance Scenarios**:

1. **Given** an account with zero recent failed attempts, **When** incorrect passwords are submitted consecutively up to the defined threshold, **Then** the account becomes locked after the final attempt.
2. **Given** a locked account, **When** the correct password is submitted, **Then** the login is still rejected, with a message indicating the account is locked rather than the generic invalid-credentials error.
3. **Given** an account that becomes locked while the user holds an active session on another device, **When** the lock takes effect, **Then** that account's renewal credentials are immediately revoked so no new access credential can be minted from them, even though a not-yet-expired access credential already in hand continues to work until its own short natural expiry.

---

### User Story 5 - User Logs Out (Priority: P3)

A signed-in user deliberately ends their current session from the device they're using.

**Why this priority**: Important for user trust and shared/borrowed-device scenarios, but the app remains fully functional and secure without an explicit logout action (sessions still expire naturally), so this is the lowest-priority piece of this feature.

**Independent Test**: Can be fully tested by logging in, logging out, and confirming the renewal credential from that session can no longer be used to obtain a new access credential, while a session on a different device (if any) is unaffected.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they log out, **Then** that session's renewal credential is immediately revoked.
2. **Given** a user logged out on one device, **When** they were also signed in on a second device, **Then** the second device's session continues working until it separately expires or is revoked.
3. **Given** a user has just logged out, **When** their already-issued access credential from that session is used again before its natural expiry, **Then** it still authenticates that single request (an accepted, time-bounded trade-off — see Assumptions) but no further renewal is possible for that session.

---

### Edge Cases

- What happens when a login attempt's password is correct but the account status is `locked` or `inactive`? (Rejected, with a message distinct from the generic invalid-credentials error, so the user knows to pursue account recovery rather than retry — User Story 4.)
- What happens when a user's password is changed (via change-password or forgot-password reset, both out of this feature's scope) while other sessions are active? (Every other active session's renewal credential is revoked; see FR-020.)
- How does the system respond if a renewal credential that was already exchanged for a new one is presented again? (Treated as a possible theft signal; every active session for that account is revoked as a precaution — see Assumptions.)
- What happens when a request arrives at the exact moment an access credential's expiry boundary is crossed? (Treated as expired; the client transparently renews via User Story 3.)
- What happens when a Company Admin or Staff account is deactivated while its user still holds a valid, not-yet-expired access credential? (That access credential remains usable only until its own short natural expiry — an accepted, bounded trade-off of short-lived credentials; the renewal credential is revoked immediately so no further access can be minted.)
- How does the system respond to a renewal request carrying a syntactically invalid, tampered, or unrecognized credential? (Rejected outright, treated the same as an expired/revoked credential — re-login required.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Upon successful completion of Student self-registration, the System MUST automatically issue the new account an authenticated session (an access credential and a renewal credential) without requiring a separate, manual login step.
- **FR-002**: System MUST allow any existing user — System Admin, Company Admin, Staff, or Student — to log in by submitting their Username and Password. For a Company-scoped role (Company Admin, Staff, Student), the login request MUST also include the Company the account belongs to (supplied implicitly by that Company's branded app build), since Username is unique only within a Company and the same Username may independently exist at more than one Company; System Admin login omits it, since that role has no Company.
- **FR-003**: System MUST verify a submitted password against the securely hashed stored credential and MUST NOT store or compare passwords in plain text.
- **FR-004**: On successful login, System MUST issue a new access credential and a new renewal credential for that session.
- **FR-005**: System MUST reject a login attempt with a single generic "invalid username or password" outcome whenever no account matches the submitted (Company, Username) pair or the password does not match, without revealing which of these was the cause — including the case where Username matches an account at a *different* Company than the one submitted, which MUST be indistinguishable from Username not existing at all.
- **FR-006**: The access credential MUST be short-lived and MUST carry the authenticated user's identity, role, and Company scope, so that every subsequent request can be authorized without needing to re-derive that scope from anything the client supplies.
- **FR-007**: System MUST derive a request's role and Company scope only from the verified access credential — never from a request body, query parameter, or path segment supplied by the client.
- **FR-008**: The renewal credential MUST be longer-lived than the access credential and MUST be tracked by the system so any individual renewal credential can be revoked on its own, independent of others belonging to the same account.
- **FR-009**: System MUST allow a client holding a valid, unrevoked, unexpired renewal credential to obtain a new access credential without re-submitting username and password.
- **FR-010**: System MUST reject a renewal request made with an expired, revoked, or unrecognized renewal credential, requiring the user to log in again with their credentials.
- **FR-011**: System MUST allow a signed-in user to log out, which immediately revokes that session's renewal credential; the already-issued access credential for that session remains usable only until it naturally expires.
- **FR-012**: System MUST count an account's consecutive failed login attempts and, upon reaching 5 consecutive failures, lock the account by setting its status to `locked`. A locked account MUST remain locked — rejecting even a correct password (FR-014) — until the user completes the forgot-password reset flow (out of this feature's scope), which resets the failed-attempt counter and restores `active` status; there is no automatic time-based unlock and no other unlock path in V1.
- **FR-013**: A successful login MUST reset that account's consecutive-failed-login counter to zero.
- **FR-014**: System MUST reject any login attempt — even one with the correct password — for an account whose status is `locked` or `inactive`, and MUST return a message distinct from the generic invalid-credentials error so the user understands their account requires recovery/reactivation rather than a retry.
- **FR-015**: System MUST immediately revoke every active renewal credential belonging to an account at the moment that account's status becomes `locked` or `inactive`, so an already-issued session cannot continue renewing itself.
- **FR-016**: System MUST allow a single user to hold more than one concurrent authenticated session (e.g., signed in on two devices at once), each with its own independent renewal credential that can be revoked without affecting the others.
- **FR-017**: System MUST detect an attempt to reuse a renewal credential that has already been exchanged for a new one, and MUST treat that reuse as a possible credential-theft signal by revoking every currently active session for that account.
- **FR-018**: System MUST record every login success, login failure, logout, and account-lock event in a manner that supports later security auditing, consistent with the platform's general auditability requirements.
- **FR-019**: A revoked or expired renewal credential MUST never, by itself, be sufficient to establish a new authenticated session — a fresh username/password login is always required once it can no longer renew.
- **FR-020**: When a user's password is successfully changed or reset (via either the authenticated change-password action or the forgot-password reset flow — both out of this feature's scope), System MUST revoke every other active session (renewal credential) belonging to that account, other than the session that performed the change, if any.

### Key Entities

- **User Credential**: The (Company, Username, Password) tuple an existing Company-scoped user authenticates with — Company is omitted only for System Admin, whose accounts are not tied to any Company. The password is never stored or compared in readable form — only a securely hashed form is retained.
- **Access Credential (Access Token)**: A short-lived, self-contained proof of an authenticated session that carries the user's identity, role, and Company scope, used to authorize every request until it naturally expires.
- **Renewal Credential (Refresh Token)**: A longer-lived credential tied to one specific session/device, tracked so it can be individually revoked, used solely to obtain a new Access Credential without re-entering a password.
- **Login Attempt Counter**: A per-account count of consecutive failed login attempts, reset to zero on any successful login, that drives the account-lockout protection.
- **Account Status**: The account-level gate (`active` / `inactive` / `locked`) checked before any credentials are even verified at login time, independent of whether the submitted password is correct.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A returning user with correct credentials reaches their signed-in home screen on the first attempt, with no more than a single login submission required.
- **SC-002**: A signed-in user can keep using the app across a normal multi-hour session without ever being unexpectedly signed out or prompted to log in again, as long as they remain within their renewal credential's validity window and do not log out.
- **SC-003**: 100% of login attempts with an incorrect password or an unrecognized username receive the identical generic error message — zero cases where a client can distinguish "wrong password" from "no such account" through the response.
- **SC-004**: 100% of locked or deactivated accounts are unable to complete a new login or obtain a new access credential, even when the correct password is supplied.
- **SC-005**: A user logging out on one device never disrupts an active session they are simultaneously using on a second device.
- **SC-006**: 100% of successful password changes or resets result in every other previously active session for that account losing the ability to make further authenticated requests once its current access credential naturally expires.

## Assumptions

- **Scope boundary with account creation**: Account creation (registration data fields, Company/Category/Department assignment, admin-created Staff/Company-Admin accounts) is fully specified by `001-company-role-user-setup`. This feature covers only the authentication mechanics layered on top of an existing or newly created account: credential verification, session issuance, renewal, revocation, and lockout.
- **Renewal credential rotation**: Each time a renewal credential is used to obtain a new access credential, the renewal credential itself is also replaced with a new one (the old one marked as superseded); this underpins the theft-detection behavior in FR-017 and is the industry-recommended option the Architecture document leaves as a choice.
- **Credential lifetimes**: For concreteness, an access credential is treated as valid for roughly 30 minutes and a renewal credential for roughly 14 days — both within the ranges already committed to by the Architecture document; exact values are an implementation detail, not a business-critical constraint, and may be tuned without changing this spec.
- **No IP- or device-based throttling in V1**: Brute-force protection in this feature is limited to the per-account consecutive-failed-attempt counter (User Story 4); network-level or device-fingerprint-based rate limiting is out of scope for V1.
- **"Log out of all devices" is not a separate self-service action in V1**: The only user-facing logout action is single-session logout (User Story 5, FR-011). Revoking *every* session for an account happens automatically as a side effect of specific security events (account lock/deactivation — FR-015; password change/reset — FR-020), not as a standalone button a user can press for its own sake.
- **No "remember me" option**: Session behavior (credential lifetimes, renewal behavior) is uniform for every login; there is no user-facing choice that changes how long a session lasts.
- **Forgot-password OTP flow is a separate concern**: The mechanics of generating, delivering, and verifying the forgot-password OTP are out of scope for this feature; this feature only specifies what happens to sessions and the failed-attempt counter as a *result* of a successful password reset (FR-013, FR-020).
