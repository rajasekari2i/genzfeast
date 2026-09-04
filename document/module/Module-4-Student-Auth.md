# Module 4: Student Auth (Registration, Login, Forgot Password)

**Covers:** PRD FR-4, FR-5
**Depends on:** Module 2 (categories/departments must exist for the dropdowns)
**Build order:** 3rd — unlocks student accounts for browsing/ordering

## Users
Student

## Screens
1. **Registration** — Name*, Username* (mobile), Password*, Category* (dropdown), Department (dropdown), Email*.
2. **Login** — Username, Password, "Forgot password" link.
3. **Forgot Password (request)** — Username, "Click to Verify".
4. **Forgot Password (verify)** — OTP, New Password, Retype Password, Submit.

## APIs

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/auth/register` | Create student user (role=student, company_id from app's tenant config) |
| POST | `/auth/login` | Validate credentials; return session/custom token; increments `no_of_login_attempt` on failure |
| POST | `/auth/forgot-password/request` | Generate alphanumeric OTP, store + expiry, send via FCM, increment `no_of_login_attempt` |
| POST | `/auth/forgot-password/verify` | Validate OTP + set new password + reset `no_of_login_attempt` to 0 |

## Business Rules
- On registration success, redirect directly to Home (auto-login).
- `no_of_login_attempt` threshold and any lockout behavior — **pending business decision** (PRD Open Question #2); implement as a configurable constant, not hardcoded.
- Forgot-password OTP has an expiry window (recommend 10 minutes) — added for security, not in the original PRD.
- On OTP mismatch during reset, show a toast/error (per PRD) and do not alter the password or increment `no_of_login_attempt` further.

## Data Touchpoints (see 03-Data-Model.md)
- `users` (create, login validation, `reset_password_otp`, `no_of_login_attempt`)
- `categories`, `departments` (read-only, for dropdowns)

## Acceptance Criteria
- **Given** valid registration details, **when** a student submits the form, **then** a `users` document is created with `role = student` and the tenant's `company_id`, and the student is auto-logged in and redirected to Home.
- **Given** an existing username, **when** a student requests password reset, **then** a 6-character alphanumeric OTP is generated, stored with an expiry, and pushed via FCM.
- **Given** a valid, unexpired OTP and matching New/Retype Password, **when** the student submits the verify form, **then** the password is updated and `no_of_login_attempt` resets to 0.
- **Given** an invalid or expired OTP, **when** the student submits the verify form, **then** an error toast is shown and no password change occurs.
