# Phase 0 Research: Forgot Password Flow (OTP-Based Reset)

**Feature**: `003-forgot-password-otp-reset` | **Date**: 2026-09-05

Depends on `001-company-role-user-setup` (the `users` table, including `status`, `no_of_login_attempt`, and the legacy `reset_password_otp`/`reset_password_otp_expires_at` columns Architecture §8 already names) and `002-registration-login-jwt-auth` (session/refresh-token revocation, the shared failed-attempt counter, and the NestJS/Supabase-Postgres baseline). This document resolves the remaining implementation-pattern unknowns specific to the reset flow itself.

## 1. Where the OTP and its expiry live

- **Decision**: Reuse the `reset_password_otp` and `reset_password_otp_expires_at` columns already named on `users` in Architecture §8, rather than a separate table. Add one more column, `reset_password_otp_attempts` (integer, default 0), to track incorrect verification attempts against the current outstanding code (research.md §4).
- **Rationale**: There is at most one outstanding reset code per account at any time (FR-014: a new request invalidates the previous one), so a one-row-per-user model is simpler than a `password_reset_codes` history table and matches the column names the Architecture document already committed to — no new entity needed.
- **Alternatives considered**: A separate `password_reset_codes` table with a row per request (audit history built in) — rejected for this feature's scope, since FR-016's auditability requirement is already satisfied by the dedicated `auth_audit_logs` table from `002` (research.md §6 there), which this feature extends with its own event types (§3 below) rather than duplicating history in a second place.

## 2. OTP hashing at rest

- **Decision**: Store a SHA-256 hash of the 6-character alphanumeric code in `reset_password_otp`, not the raw code, mirroring the refresh-token storage pattern from `002` (research.md §3 there).
- **Rationale**: The spec's own Assumption ("the stored one-time code is treated with the same handling care as a password") calls for this directly. A 6-character alphanumeric code has a smaller keyspace than a refresh token, but hashing it costs nothing and removes the code from plaintext exposure in a database dump or backup.
- **Alternatives considered**: Storing the raw code — simpler, but inconsistent with the platform's own stated handling-care assumption and with the precedent already set for refresh tokens in `002`.

## 3. Extending the auth-audit trail for reset events

- **Decision**: Add three new `event_type` values to the `auth_audit_logs` table introduced in `002` (data-model.md there): `password_reset_requested`, `password_reset_succeeded`, `password_reset_failed_verification`. No new table.
- **Rationale**: `002` already built exactly the right shape of table for "security events that aren't row mutations" (FR-016 here is the same kind of requirement as `002`'s FR-018). Reusing it keeps one place to query "everything that happened to this account's login/recovery security," rather than splitting reset events into a second log table a reviewer would also have to check.
- **Alternatives considered**: A dedicated `password_reset_audit_logs` table — rejected as unnecessary duplication of a table shape `002` already provides.

## 4. Incorrect-attempt limiting mechanism

- **Decision**: `reset_password_otp_attempts` increments on every Verify submission that fails to match the stored (hashed) code; reaching 5 (spec Assumption) clears `reset_password_otp`/`reset_password_otp_expires_at` outright — i.e., the limit is enforced by invalidating the code itself, not by a separate lockout state. A fresh request (User Story 1) always resets this counter to 0 along with issuing a new code.
- **Rationale**: This keeps "an OTP is invalid" a single, simple condition to check at Verify time (`reset_password_otp IS NULL OR expires_at < now() OR attempts >= 5`), reusing the same column set rather than introducing a distinct "OTP locked" status that would need its own unlock path.
- **Alternatives considered**: Locking the whole account after too many bad OTP guesses (in addition to the request-level counter from FR-005) — rejected as redundant: the account-level counter (shared with login, `002`) already provides an account-wide brute-force brake, so a second, code-specific lock would duplicate that protection without adding coverage for a materially different attack.

## 5. Anti-enumeration timing

- **Decision**: The `/auth/forgot-password` request handler performs the same amount of work (a DB lookup, and — only if the account exists — OTP generation, hashing, and an FCM send) regardless of outcome, and always returns the same response shape and status code. When the account does not exist, the handler still takes a comparable code path (no OTP generation, but no early-return that would make the response measurably faster) to avoid a timing side-channel revealing account existence.
- **Rationale**: Directly implements FR-004/SC-002. A naive "return early if user not found" implementation would be functionally correct per the response body but could leak existence through response-time differences; calling this out here prevents that during implementation.
- **Alternatives considered**: Only matching the response body, not timing — rejected as an incomplete implementation of the spec's own anti-enumeration intent, given timing side-channels are a well-known enumeration vector for exactly this kind of endpoint.

## Outstanding NEEDS CLARIFICATION

None. The spec shipped with zero clarification markers (all gaps closed via documented Assumptions).
