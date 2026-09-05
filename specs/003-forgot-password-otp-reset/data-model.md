# Phase 1 Data Model: Forgot Password Flow (OTP-Based Reset)

**Feature**: `003-forgot-password-otp-reset` | **Date**: 2026-09-05

Extends the `users` table from `001-company-role-user-setup` with three columns and reuses the `auth_audit_logs` table from `002-registration-login-jwt-auth` with three new event types. No new tables.

## Changes to `users` (additive migration on top of `001`)

| Column | Type | Constraints / Notes |
|---|---|---|
| `reset_password_otp` | `text` | nullable — SHA-256 hex digest of the current outstanding 6-character alphanumeric code (research.md §2); `NULL` when no reset is in progress |
| `reset_password_otp_expires_at` | `timestamptz` | nullable — set alongside `reset_password_otp`; a code is usable only while `now() < reset_password_otp_expires_at` |
| `reset_password_otp_attempts` | `integer` | not null, default `0` — incorrect Verify submissions against the current code (research.md §4); reset to `0` whenever a new code is issued |

**Validity rule** (API-layer, checked on every Verify submission): a code is usable only when `reset_password_otp IS NOT NULL AND reset_password_otp_expires_at > now() AND reset_password_otp_attempts < 5`. Any other state is rejected identically per FR-012 (no distinct error revealing which condition failed).

## Reused from `002-registration-login-jwt-auth`: `auth_audit_logs` — new `event_type` values

| `event_type` | Written when |
|---|---|
| `password_reset_requested` | Every call to the request endpoint, whether or not the username resolved to a real account (only `user_id` differs: populated for a real account, `NULL` otherwise — research.md §5) |
| `password_reset_succeeded` | A Verify submission's code matched and the password was updated (FR-009) |
| `password_reset_failed_verification` | A Verify submission was rejected — wrong code, expired code, or attempt-limit exceeded (FR-012, FR-015); the specific reason is recorded for internal diagnostics only, never surfaced to the client beyond the single generic error |

## Interaction with existing columns (owned by other features, read/written here)

| Column | Feature of origin | How this feature touches it |
|---|---|---|
| `users.password_hash` | `001` | Overwritten with the new password's hash on a successful reset (FR-009) |
| `users.status` | `001` | Read to allow the flow even when `locked` (FR-006); written back to `active` on success if it was `locked` (FR-010) — never touched for an `inactive` account (Edge Cases) |
| `users.no_of_login_attempt` | `002` | Incremented on every reset request (FR-005); reset to `0` on a successful reset (FR-010) — the same counter driving login lockout |
| `refresh_tokens` | `002` | Every row with `revoked_at IS NULL` for the account is set to `revoked_at = now()` on a successful reset (FR-011), following the exact revocation mechanism `002` already defines for account-lock/password-change events |

## State Transitions

**Reset-code lifecycle** (all state lives on the `users` row itself, per §1 above):
```
no code outstanding --(request)--> code issued (attempts=0, expires_at set)
code issued --(new request before use/expiry)--> previous code discarded, new code issued (attempts reset to 0)
code issued --(correct Verify submission)--> code cleared (reset_password_otp = NULL), password updated
code issued --(incorrect Verify submission, attempts < 5)--> attempts += 1, code remains outstanding
code issued --(incorrect Verify submission, attempts reaches 5)--> code cleared, requires a new request
code issued --(expires_at passed)--> treated as cleared on next check, no explicit write required until the next request overwrites it
```

**Account status, as affected by this feature** (status itself owned by `001`, lockout mechanics by `002`; this feature is the only self-service path shown here):
```
locked --(successful reset via this flow)--> active (no_of_login_attempt reset to 0)
```
`inactive` is never transitioned by this feature (Edge Cases: an admin-deactivated account cannot self-reactivate here).
