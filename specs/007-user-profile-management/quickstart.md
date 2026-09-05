# Quickstart: Validating User Profile (View, Edit, Change Password)

**Feature**: `007-user-profile-management`

Manual/scriptable validation guide against `contracts/openapi.yaml` and `data-model.md`. Requires `001` and `002`'s migrations applied — no migration of its own to run. Needs one Student account and one Company Admin or Staff account.

## Prerequisites

- A running API instance with `001`'s `users`/`departments` and `002`'s `refresh_tokens`/`auth_audit_logs` in place.
- A Student account with a Department already set, and a second Department in the same Company available to switch to.
- A second Company with its own Department, to test the cross-tenant rejection.

## Scenario 1 — View profile is role-aware (User Story 1)

1. As the Student, `GET /me/profile`.
   - **Expect**: `200`, includes `name`, `username`, `email`, `category`, `department`; no `company` field (or `null`).
2. As the Company Admin/Staff account, `GET /me/profile`.
   - **Expect**: `200`, includes `name`, `username`, `email`, `company`; no `category`/`department`.

## Scenario 2 — Edit profile (User Story 2)

1. As the Student, `PATCH /me/profile` with a new, validly formatted `email`.
   - **Expect**: `200`, `email` updated; a follow-up `GET /me/profile` confirms it persisted.
2. `PATCH /me/profile` with `email: "not-an-email"`.
   - **Expect**: `400`; a follow-up `GET` confirms the email from step 1 is unchanged (no partial save).
3. `PATCH /me/profile` with `department_id` set to a department belonging to the **other** Company.
   - **Expect**: `400` — rejected as not resolvable under the caller's own company scope (research.md §3).
4. `PATCH /me/profile` with `department_id` set to a valid department in the Student's **own** company.
   - **Expect**: `200`, `department` updated.
5. Attempt `PATCH /me/profile` with a `name` field in the body (even though the schema doesn't declare it).
   - **Expect**: the field is ignored / has no effect — a follow-up `GET` shows `name` unchanged (FR-008).

## Scenario 3 — Change password (User Story 3)

1. As the Student, `POST /me/change-password` with `new_password` != `retype_password`.
   - **Expect**: `400` — and confirm (via a test hook or timing/log check) that the current-password check was never reached.
2. `POST /me/change-password` with the wrong `current_password`.
   - **Expect**: `401`; a subsequent login with the *old* password still succeeds (nothing changed).
3. Log in on a second device/session (two separate `Session`s now exist for this Student).
   - Then, from session 1, `POST /me/change-password` with the correct current password, a new password, and `refresh_token` set to session 1's own refresh token.
   - **Expect**: `200`.
4. Attempt `POST /auth/refresh` using session 1's refresh token (the one just submitted).
   - **Expect**: `200` — that session was preserved (research.md §2).
5. Attempt `POST /auth/refresh` using session 2's refresh token.
   - **Expect**: `401` — session 2 was revoked by the password change (FR-012).
6. Log in with the new password.
   - **Expect**: `200` — confirms the password was actually updated.

## Pass/Fail

Any deviation — especially `name`/`username`/`category` ever changing through this feature, a cross-tenant department being accepted (Scenario 2 step 3), or a session surviving a password change when it wasn't the one identified for preservation (Scenario 3 step 5) — is a blocking failure per SC-003/SC-004/SC-005 and must not ship.
