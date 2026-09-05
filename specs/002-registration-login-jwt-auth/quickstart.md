# Quickstart: Validating Registration & Login with JWT Authentication

**Feature**: `002-registration-login-jwt-auth`

Manual/scriptable validation guide against `contracts/openapi.yaml` and `data-model.md`. Requires the `001-company-role-user-setup` migrations and at least one Company + Category already set up (see that feature's own quickstart, Scenario 1–2).

## Prerequisites

- A running API instance with the `refresh_tokens` and `auth_audit_logs` migrations applied, on top of `001`'s schema.
- A Company with at least one Category, from `001`'s quickstart.
- An HTTP client (`curl`/Postman) or the contract-test suite.

## Scenario 1 — Registration issues a session (User Story 1)

1. `POST /auth/register` with a valid Student registration body (per `001`'s `StudentRegisterRequest`).
   - **Expect**: `201`, response includes `user` and a `Session` (`access_token`, `refresh_token`, `expires_in`).
2. Immediately call any authenticated endpoint (e.g., `GET /tenant/categories`) with `Authorization: Bearer <access_token>` from step 1.
   - **Expect**: `200`, scoped to the registrant's own company — no separate login call was made.

## Scenario 2 — Login success and failure (User Story 2)

1. `POST /auth/login` with the correct username/password for an existing account of any role.
   - **Expect**: `200`, a fresh `Session`; `no_of_login_attempt` on that user is `0` afterward.
2. `POST /auth/login` with a wrong password for that same account.
   - **Expect**: `401`, generic message.
3. `POST /auth/login` with a username that does not exist at all.
   - **Expect**: `401`, the **same** generic message as step 2 (byte-for-byte identical body) — confirms FR-005/SC-003.
4. `POST /auth/login` for a Student whose Company has `is_open: false` (from `001` Scenario 1 step 4).
   - **Expect**: `200` — closed status does not block login.

## Scenario 3 — Silent session renewal (User Story 3)

1. Using the `refresh_token` from Scenario 2 step 1, call `POST /auth/refresh`.
   - **Expect**: `200`, a **new** `access_token` and a **new** `refresh_token` (different string from the one submitted).
2. Immediately re-submit the original (now-rotated-away) `refresh_token` to `POST /auth/refresh` again.
   - **Expect**: `401` — and per research.md §4, this should also revoke the token obtained in step 1 (verify by attempting to use *that* token next: it should now also fail with `401`), confirming reuse-detection (FR-017).
3. Log in twice (two independent `Session`s, simulating two devices), then refresh each independently.
   - **Expect**: both succeed independently; refreshing one never invalidates the other (FR-016).

## Scenario 4 — Account lockout at 5 failed attempts (User Story 4)

1. `POST /auth/login` with a wrong password for the same account, 5 times consecutively.
   - **Expect**: attempts 1–4 return `401` (generic); the account's `no_of_login_attempt` reaches 5 and its `status` becomes `locked`.
2. `POST /auth/login` immediately after, with the **correct** password.
   - **Expect**: `403` with the locked-account message (FR-014) — not `200`, and not the generic `401`.
3. Check `refresh_tokens` for that user (or attempt to refresh a session obtained before the lock).
   - **Expect**: any pre-existing refresh token for that user is now revoked (FR-015) — refreshing it returns `401`.

## Scenario 5 — Logout (User Story 5)

1. `POST /auth/login`, then `POST /auth/logout` with that session's `refresh_token`.
   - **Expect**: `204`.
2. Attempt `POST /auth/refresh` with the same (now-logged-out) `refresh_token`.
   - **Expect**: `401`.
3. If a second session (different login) exists for the same user, confirm it still refreshes successfully after step 1 — logout only affects the one session (FR-011, SC-005).

## Pass/Fail

Any deviation from the **Expect** outcomes above — especially a distinguishable error between "wrong password" and "no such user" (Scenario 2), or a session surviving a lock/logout it shouldn't (Scenarios 4–5) — is a blocking failure per SC-003/SC-004/SC-005 and must not ship.
