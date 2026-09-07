# Feature Specification: Forgot Password Flow (OTP-Based Reset)

**Feature Branch**: `003-forgot-password-otp-reset`

**Created**: 2026-09-05

**Status**: Draft

**Input**: User description: "GenzFeast is a multi-tenant (multi-company) mobile food ordering platform that connects college canteens (\"companies\"/tenants) with students on their campus. Each canteen operates as an independent tenant with its own staff, products, and orders, while a central System Admin governs onboarding and platform-wide oversight. Analyse the BRD, PRD, Architecture, and UI Design docs and spec the Forgot Password flow."

## Clarifications

### Session 2026-09-06

- Q: `username` (mobile number) is unique per Company only, not globally — `002-registration-login-jwt-auth` resolved the identical ambiguity for `/auth/login` by adding `company_id` to that request. Does the same apply here, since both endpoints in this feature also key solely on `username`? → A: Yes — for consistency with `002`'s already-shipped resolution. `/auth/forgot-password/request` and `/auth/forgot-password/verify` both gain an optional `company_id` (required in practice for every role except `system_admin`), supplied the same way `002` supplies it: implicitly, by each Company's branded app build. Anti-enumeration (FR-004) is unaffected — the response stays identical regardless of whether the `(company_id, username)` pair resolves to an account.
- Q: FR-003 requires the code to be shown in-app as a fallback, and SC-006 requires this to work even when "a push notification [is never] delivered" — but the Assumptions also say the code must never be exposed via any API response. Since a REST response is the only channel available besides the push itself, how can the app show the code without an API exposing it, in the case where delivery genuinely fails end-to-end? → A: The code travels only inside the FCM push's *data payload*, which the app's background message handler can read and render on the Verify screen even when the OS suppresses the visible notification banner — this is what "fallback" and "no notification delivered" mean here (a suppressed/never-tapped banner, not a total FCM infrastructure failure). The code is still never returned by any REST response, preserving the sensitive-data Assumption exactly as written; a true end-to-end FCM delivery failure (not just a suppressed banner) is out of scope — the user requests a new code once connectivity/FCM registration is restored, the same way any other undelivered push would be retried.
- Q: `009-order-fcm-push-notifications` (which owns device-token registration as shared infrastructure) cascades: the moment an account becomes `locked`, every one of its registered devices is deleted — the same event that sends a user to this feature's Forgot Password screen in the first place. Without a live device registration, the FCM-data-payload delivery this feature already committed to (above) has no device to reach. How does a locked account's request still get a working push channel? → A: `009` exposes an unauthenticated device-registration path this feature's request endpoint calls: `POST /auth/forgot-password/request` gains an optional `fcm_token` field alongside `username`/`company_id`; when present, the account it resolves to (the same lookup already performed for FR-001/FR-004 — this never runs for a username that doesn't resolve, so it adds no new enumeration surface) has that token registered for it immediately, with no session required. This is `009`'s FR-011, not a new mechanism invented here — see that spec's Clarifications and research.md §7.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Request a Password Reset OTP (Priority: P1)

A user who cannot remember their password asks the app to help them back in by submitting their username, so a one-time code is generated for them to prove it's really their account.

**Why this priority**: This is the entry point of the entire flow — nothing else in this feature can happen without it, and it is the only self-service way a user regains access once they've forgotten their password.

**Independent Test**: Can be fully tested by submitting a known username on the "Forgot Password" screen and confirming a one-time code is generated for that account and a confirmation is shown to the user, without requiring any other part of this feature.

**Acceptance Scenarios**:

1. **Given** a user on the Forgot Password screen, **When** they submit their Username, **Then** the system generates a one-time code tied to that account and shows a confirmation that a code is on its way, then takes them to the Verify screen.
2. **Given** a Username that does not correspond to any existing account, **When** it is submitted, **Then** the system shows the exact same confirmation as for a real account, without revealing that no such account exists.
3. **Given** an account whose Company is currently closed for ordering, **When** that account's user requests a reset code, **Then** the request still succeeds — a closed Company blocks ordering only, not account recovery.
4. **Given** an account that is currently locked (from too many failed logins), **When** its user requests a reset code, **Then** the request still succeeds — this is the account's only path back to working order.

---

### User Story 2 - Verify the Code and Set a New Password (Priority: P1)

Having received their one-time code, the user enters it along with a new password to regain access to their account.

**Why this priority**: This is the step that actually restores access — without it, User Story 1 alone accomplishes nothing. Together, Stories 1 and 2 are the minimum viable version of this entire feature.

**Independent Test**: Can be fully tested by requesting a code (User Story 1), then submitting that exact code with a new password and confirming the account's password is updated and a subsequent login with the new password succeeds.

**Acceptance Scenarios**:

1. **Given** a user on the Verify screen holding a just-issued, still-valid code, **When** they submit that code with a New Password and a matching Retype Password, **Then** the account's password is updated and the code can never be used again.
2. **Given** a successful password reset, **When** the system checks that account afterward, **Then** its consecutive-failed-attempt count has been reset to zero and, if it was locked, its status is now active.
3. **Given** a successful password reset, **When** the system checks for other sessions the account may have had active before the reset, **Then** every one of them has been ended, other than the session performing the reset (if applicable).
4. **Given** a user on the Verify screen, **When** they enter a New Password and a Retype Password that don't match each other, **Then** the system rejects the submission and does not attempt to validate the code at all.
5. **Given** a user on the Verify screen, **When** they submit a code that doesn't match the one currently on file for their account, **Then** the system rejects the submission with a clear error and the password is left unchanged.

---

### User Story 3 - See the Code In-App Even Without a Notification (Priority: P2)

A user whose device doesn't show the push notification — because notifications are disabled, delayed, or the OS suppressed it — can still see their one-time code directly on the Verify screen, so a missed notification never locks them out of recovering their own account.

**Why this priority**: This directly protects the core promise of User Stories 1–2 (self-service recovery) from a real-world delivery failure mode; it's a resilience layer on top of the already-functional flow, so it can follow the primary path.

**Independent Test**: Can be fully tested by requesting a code with push notifications disabled or simulated as undelivered, and confirming the Verify screen still displays a usable code obtained independently of the notification channel.

**Acceptance Scenarios**:

1. **Given** a user has just requested a code and the OS suppresses or the user never sees the visible notification banner, **When** they view the Verify screen, **Then** the code needed to complete the reset is available to them directly in the app — read by the app from the push's data payload in the background, not from the user having tapped a notification (spec.md Clarifications 2026-09-06). A true end-to-end FCM delivery failure (the data payload itself never reaching the device) is out of scope; the user requests a new code once connectivity/registration is restored.

---

### User Story 4 - Expired or Already-Used Codes Cannot Be Reused (Priority: P2)

Old codes stop working — whether because time has passed or because they were already used or guessed incorrectly too many times — so a leaked or stale code can't be used to hijack an account later.

**Why this priority**: This is a security control layered on top of the core flow (User Stories 1–2); the feature is usable without it, but shipping without it leaves password-reset codes valid indefinitely, which is an unacceptable risk to launch with.

**Independent Test**: Can be fully tested by letting a requested code expire (or using it once successfully, or guessing it incorrectly past the allowed limit) and then confirming a subsequent attempt to use that same code is rejected.

**Acceptance Scenarios**:

1. **Given** a code that has passed its expiry time, **When** a user submits it on the Verify screen, **Then** the system rejects it and the user must request a new code.
2. **Given** a code that has already been successfully used for a password reset, **When** anyone submits that same code again, **Then** the system rejects it.
3. **Given** a user has submitted an incorrect code repeatedly against the same outstanding request past the allowed number of tries, **When** they try again — even with the correct code — **Then** that code is no longer accepted and a new request is required.
4. **Given** a user requests a new code while a previous one they requested is still outstanding, **When** the new code is generated, **Then** the previous code is immediately invalidated, so only the newest code can ever succeed.

---

### Edge Cases

- What happens when a user's repeated forgot-password requests push their consecutive-attempt count to the lockout threshold on their own, without any failed logins involved? (The account locks exactly as it would from failed logins — see FR-005 — and the very next successful reset unlocks it again.)
- How does the system respond to a Verify submission where the code is correct but the account has since been deactivated by an admin (not locked, but `inactive`)? (Rejected — a deactivated account cannot be reactivated through this self-service flow; that remains an admin action, out of this feature's scope.)
- What happens if a user requests a code, then closes the app before seeing either the notification or the in-app fallback, and reopens the app later? (As long as the code hasn't expired, reopening to the Verify screen still shows it — see User Story 3.)
- How does the system handle a Verify submission for an account that never had a code requested (or whose only code already expired hours ago with no new request since)? (Rejected the same way as any invalid/expired code — no distinct error that would reveal internal state.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow any user — System Admin, Company Admin, Staff, or Student — who cannot remember their password to initiate a password-reset request by submitting their Username (and, for a Company-scoped role, the Company the account belongs to — supplied implicitly by that Company's branded app build, per `002-registration-login-jwt-auth`'s identical resolution for login; System Admin omits it, since that role has no Company).
- **FR-002**: Upon a password-reset request, System MUST generate a 6-character alphanumeric one-time code tied to that account and set an expiry time on it.
- **FR-003**: System MUST deliver the generated code to the user via a push notification whose *data payload* carries the code, and the app MUST display that code directly on the Verify screen from that payload as a fallback — read by the app's background message handler even when the OS suppresses the visible notification banner — so a suppressed or unseen banner never blocks the user from completing the reset (User Story 3, spec.md Clarifications 2026-09-06). The code MUST NOT be returned by any REST API response (see Assumptions "Sensitive-data handling for the code").
- **FR-004**: System MUST respond identically to a password-reset request regardless of whether the submitted (Company, Username) pair corresponds to an existing account — including when Username matches an account at a *different* Company than the one submitted — so a requester cannot determine account existence, or which Company it belongs to, from the response.
- **FR-005**: Each password-reset request MUST increment the same consecutive-failed-attempt counter that failed logins increment, meaning an account can become locked purely from repeated reset requests just as it can from failed logins.
- **FR-006**: System MUST allow a password-reset request and its verification to proceed for an account regardless of whether that account's status is currently `active` or `locked` — successfully completing this flow is the account's only path back from `locked` to `active`.
- **FR-007**: System MUST present a Verify step that collects the one-time code, a New Password, and a Retype Password together.
- **FR-008**: System MUST reject a Verify submission whose New Password and Retype Password do not match each other, without needing to validate the code to do so.
- **FR-009**: System MUST validate a submitted code against the account's current, unexpired, unused code; on a match, it MUST update the account's password to the submitted New Password and permanently invalidate that code.
- **FR-010**: On a successful password reset, System MUST reset that account's consecutive-failed-attempt counter to zero and, if the account was `locked`, restore it to `active`.
- **FR-011**: On a successful password reset, System MUST end every other session that was active for that account beforehand, leaving only the session that performed the reset (if any) still active.
- **FR-012**: System MUST reject a Verify submission whose code does not match the account's current code, or whose code has expired, with a clear error, and MUST NOT alter the password in that case.
- **FR-013**: A code MUST become permanently unusable immediately after it is successfully used to reset a password.
- **FR-014**: Requesting a new code MUST immediately invalidate any previous, still-outstanding code for that account, so only the most recently requested code can ever succeed.
- **FR-015**: System MUST limit the number of incorrect code submissions allowed against a single outstanding code; once that limit is reached, that code becomes invalid regardless of whether it is later submitted correctly, and the user must request a new one.
- **FR-016**: System MUST record every password-reset request, successful reset, and failed verification attempt in a manner that supports later security auditing, consistent with the platform's general auditability requirements.
- **FR-017**: A password-reset request MAY optionally include the requesting device's push-notification token; when the submitted `(company_id, username)` resolves to a real account, System MUST register that token for the account (via `009-order-fcm-push-notifications`'s shared, unauthenticated device-registration path) so the account has a working channel to receive FR-003's push even if every one of its normal, session-linked device registrations was just removed by an account-lock event (spec.md Clarifications 2026-09-06). This registration MUST NOT alter the request's response in any way — FR-004's identical-response guarantee still holds regardless of whether a token was submitted or whether the account existed.

### Key Entities

- **Password Reset Code**: A short-lived, single-use alphanumeric code associated with exactly one account, generated on request and used solely to prove the requester controls that account before a new password is accepted. Superseded by any newer code requested for the same account, and invalidated after use, expiry, or too many incorrect attempts.
- **Consecutive Failed-Attempt Counter**: The same per-account counter driven by failed logins (see `002-registration-login-jwt-auth`), also incremented by each reset request, and the only counter whose reset back to zero (via a successful password reset here) restores a locked account to `active`.
- **Account Status**: The `active`/`inactive`/`locked` gate on the account; this feature is the sole self-service path from `locked` back to `active`, but never touches an `inactive` account's status (FR: see Edge Cases).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user who has forgotten their password can regain the ability to log in — end to end, from requesting a code to successfully logging in with their new password — in under 5 minutes, without contacting support or an administrator.
- **SC-002**: 100% of password-reset requests produce the identical on-screen confirmation whether or not the submitted username belongs to a real account.
- **SC-003**: 100% of accounts locked solely due to failed login or reset-request attempts can be restored to active use through this flow alone, with zero cases requiring manual/admin intervention.
- **SC-004**: 100% of expired codes, already-used codes, and codes resubmitted after exceeding the incorrect-attempt limit are rejected on resubmission.
- **SC-005**: 100% of sessions that were active for an account before a password reset — other than the one performing the reset — are unable to continue afterward.
- **SC-006**: Users can complete a reset entirely without ever seeing or tapping a visible notification banner, by using the code the app reads from the push's data payload and shows in-app (spec.md Clarifications 2026-09-06).

## Assumptions

- **Code expiry window**: A requested code is valid for approximately 10 minutes. This is a tunable operational parameter, not a business-critical constraint, and may be adjusted during planning without revising this spec.
- **Incorrect-attempt limit per code**: A single outstanding code accepts at most 5 incorrect submissions before it is invalidated (mirroring the 5-attempt threshold already established for login lockout in `002-registration-login-jwt-auth`, for consistency). This is distinct from and additional to FR-005's request-level counter.
- **Anti-enumeration by default**: This flow follows the same convention already established for login (`002-registration-login-jwt-auth` FR-005/SC-003) — a password-reset request never reveals whether the submitted username exists.
- **Applies uniformly across roles**: Since login itself is shared across every role, this reset flow is available the same way to System Admin, Company Admin, Staff, and Student accounts alike — there is no role-specific variation.
- **Sensitive-data handling for the code**: The stored one-time code is treated with the same handling care as a password (never logged in plaintext, not exposed via any API beyond the Verify step's own validation); the specific storage mechanism is an implementation decision for the planning phase, not a business-facing constraint captured here.
- **Scope boundary with account/session mechanics**: Account fields (`status`, the failed-attempt counter) are owned by `001-company-role-user-setup`; session issuance and revocation mechanics are owned by `002-registration-login-jwt-auth`. This feature specifies only the reset flow itself and the specific state changes (FR-010, FR-011) it triggers in those other features' entities.
- **Device registration is `009`'s infrastructure, not reimplemented here**: FR-017's device-token registration on request is a thin call into `009-order-fcm-push-notifications`'s shared `device_registrations` mechanism (that spec's FR-011) — this feature does not own or duplicate that table/logic, only triggers it at one additional call site.
