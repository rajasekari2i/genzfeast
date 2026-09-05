# Quickstart: Validating the Forgot Password Flow

**Feature**: `003-forgot-password-otp-reset`

Manual/scriptable validation guide against `contracts/openapi.yaml` and `data-model.md`. Requires `001`'s and `002`'s migrations applied, plus at least one existing account (any role) to test against.

## Prerequisites

- A running API instance with the `users.reset_password_otp*` columns (this feature's migration) and `002`'s `refresh_tokens`/`auth_audit_logs` tables in place.
- An existing account with a known username, in a known-good `active` state.
- Ability to intercept/read the generated code directly from the database or test logs (since FCM delivery itself is out of this feature's testable surface — the in-app fallback is what's being validated, not the push channel).

## Scenario 1 — Request a code, generic response either way (User Story 1)

1. `POST /auth/forgot-password/request` with an existing username.
   - **Expect**: `202`, generic acknowledgment body. `users.reset_password_otp`/`reset_password_otp_expires_at` are now set for that account.
2. `POST /auth/forgot-password/request` with a username that does not exist.
   - **Expect**: `202`, **byte-for-byte identical** body to step 1 — confirms FR-004/SC-002.
3. Repeat step 1 for an account whose Company `is_open: false`.
   - **Expect**: `202` — closed status doesn't block recovery.
4. Repeat step 1 for an account already `locked` (e.g., from `002`'s lockout scenario).
   - **Expect**: `202` — locked accounts can still request a code (FR-006).

## Scenario 2 — Verify and reset (User Story 2)

1. Using the code generated in Scenario 1 step 1 (read from the DB/test hook, standing in for the in-app fallback display), `POST /auth/forgot-password/verify` with matching `new_password`/`retype_password`.
   - **Expect**: `200`. `users.password_hash` is updated; `reset_password_otp` is now `NULL`; `no_of_login_attempt` is `0`; `status` is `active` (even if it was `locked` beforehand).
2. Check `refresh_tokens` for that user: any row that was active before step 1 now has `revoked_at` set (FR-011).
3. `POST /auth/login` with the new password.
   - **Expect**: `200` — proves the reset actually took effect end-to-end (SC-001).
4. Repeat step 1's exact same request (same code) again.
   - **Expect**: `422` — the code was already consumed (FR-013).

## Scenario 3 — Mismatched new/retype password (User Story 2, FR-008)

1. `POST /auth/forgot-password/verify` with a valid, unused code but `new_password` != `retype_password`.
   - **Expect**: `400` — rejected before any code-matching logic runs (confirm via test hook that `reset_password_otp_attempts` was **not** incremented by this call).

## Scenario 4 — Expiry, wrong code, and attempt-limit (User Story 4)

1. Request a code, then wait past its expiry window (or fast-forward the test clock / directly set `reset_password_otp_expires_at` to the past).
   - **Expect**: `POST /auth/forgot-password/verify` with the otherwise-correct code returns `422`.
2. Request a fresh code, then submit an incorrect code 5 times in a row.
   - **Expect**: all 5 return `422`; `reset_password_otp_attempts` reaches 5 and the code is cleared.
3. Immediately submit the **correct** code for that same (now-invalidated) request.
   - **Expect**: `422` — the correct code no longer works once the attempt limit was hit (FR-015).
4. Request a code, then request a second code before using the first.
   - **Expect**: the first code, if submitted now, returns `422`; only the second (most recent) code succeeds (FR-014).

## Pass/Fail

Any deviation — especially the request endpoint ever distinguishing "account exists" from "account doesn't" (Scenario 1), or a used/expired/over-attempted code succeeding (Scenarios 2 and 4) — is a blocking failure per SC-002/SC-004 and must not ship.
