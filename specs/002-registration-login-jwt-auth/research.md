# Phase 0 Research: Registration & Login with JWT Authentication

**Feature**: `002-registration-login-jwt-auth` | **Date**: 2026-09-05

Depends on `specs/001-company-role-user-setup` for the `users`/`companies`/`roles` schema (including the existing `password_hash`, `status`, `no_of_login_attempt` columns on `users`) and its NestJS/Supabase-Postgres technical baseline (`001` research.md §1–§2), which this feature reuses rather than re-deciding. This document resolves the implementation-pattern unknowns specific to authentication.

## 1. Password hashing algorithm

- **Decision**: Argon2id (via the `argon2` library), not bcrypt.
- **Rationale**: PRD §4 and Architecture §10 explicitly allow "bcrypt/argon2." Argon2id is OWASP's current first recommendation for new systems (memory-hard, resists GPU/ASIC cracking better than bcrypt) and this is a greenfield choice with no legacy bcrypt hashes to migrate. FR-003's requirement (never store/compare plaintext) is satisfied by either; Argon2id is simply the stronger default for a system storing real payment-linked identities.
- **Alternatives considered**: bcrypt — mature and simpler to reason about (fixed cost factor, no memory-cost tuning), and still fully acceptable per PRD/Architecture; rejected only because Argon2id is the better default with no offsetting cost for a new system.

## 2. JWT signing algorithm

- **Decision**: HS256 (symmetric) with a single backend-held signing secret, stored in a secret manager (Architecture §9).
- **Rationale**: Architecture §4.1 explicitly leaves the door open to "asymmetric key pair for future multi-service verification" but does not require it now — there's exactly one service (the Node API) that both issues and verifies access tokens in the current architecture (§5's component diagram shows no second service independently verifying tokens). HS256 is simpler to operate (one secret, no key-pair/JWKS distribution) and meets every requirement in this spec.
- **Alternatives considered**: RS256/asymmetric — the right choice if a second service (e.g., a future analytics or reporting service) needs to verify tokens without holding the signing secret; deferred until that need materializes, since adopting it now adds key-rotation/JWKS-hosting complexity with no current consumer.

## 3. Refresh token representation and storage

- **Decision**: The refresh token itself is a high-entropy opaque random string (e.g., 256 bits from a CSPRNG), never a JWT. Only its SHA-256 hash is persisted, in a new `refresh_tokens` table (Architecture §4.1). The raw token is returned to the client exactly once, at issuance/rotation, and is never written to any log.
- **Rationale**: This is Architecture §4.1's explicit design ("Its SHA-256 hash is stored... the raw token is sent to the client only once and never persisted server-side"). An opaque token (vs. a second JWT) avoids any temptation to "peek" at refresh-token claims client-side and keeps its only job — proving possession to the `/auth/refresh` endpoint — clean.
- **Alternatives considered**: A second, longer-lived JWT as the refresh token — rejected because it would invite the same claims (role/company_id) to go stale inside it across the token's multi-week lifetime, whereas the current design always re-derives fresh claims for the new access token from the live `users`/`roles` row at refresh time (so a role change or company reassignment — out of this feature's scope but a real future case — takes effect on the very next refresh, not just the next login).

## 4. Refresh token rotation & reuse (theft) detection

- **Decision**: Every `/auth/refresh` call that succeeds issues a brand-new refresh token and immediately marks the presented one `revoked_at = now()`, `replaced_by = <new token id>`. If a token is presented that is already `revoked_at IS NOT NULL` (i.e., someone is replaying a token that was already exchanged), the system revokes every refresh token belonging to that `user_id` — not just the one presented — since a rotated-and-then-reused token is the standard signal that a refresh token was stolen and both the legitimate holder and the attacker now hold copies.
- **Rationale**: Implements spec Assumption "Renewal credential rotation" and FR-017 exactly. This is the mechanism, not just a nice-to-have — it's the only way FR-017 ("detect an attempt to reuse a renewal credential that has already been exchanged") is testable/observable at all.
- **Alternatives considered**: Non-rotating refresh tokens (issue once, reuse until natural expiry) — simpler, but then a leaked refresh token is indistinguishable from the legitimate one for its entire multi-week lifetime with no way to detect the leak; rejected as it makes FR-017 impossible to implement.

## 5. Where the account-status / lockout check happens relative to password verification

- **Decision**: On every login attempt, look up the account by username first. If it does not exist, or if it exists but `status = 'locked'` or `status = 'inactive'`... the two cases are handled differently on purpose:
  - Unknown username **or** wrong password → the generic FR-005 error, and (only for an existing account) the failed-attempt counter increments.
  - Existing account, correct-or-incorrect password, but `status IN ('locked','inactive')` → the distinct FR-014 error, checked regardless of whether the password would have matched, and the password comparison is skipped entirely (no need to spend an Argon2id hash cycle on an account that cannot log in anyway).
- **Rationale**: This ordering is exactly what Architecture §4.3 specifies ("`no_of_login_attempt` and `status = 'locked'`... are checked by the login endpoint **before** issuing any token") and matches the spec's own deliberate distinction between the two error messages (FR-005 vs. FR-014) — locked/inactive is not meant to be indistinguishable from wrong-password, only "no such user" vs. "wrong password" are meant to be indistinguishable.
- **Alternatives considered**: Checking status only after a successful password match (so a wrong password on a locked account looks identical to a wrong password on an active account) — rejected, since the spec explicitly wants a locked user to be told to seek recovery rather than keep guessing their password, which requires surfacing the locked state independent of password correctness.

## 6. Auditing login/logout/lock events

- **Decision**: A dedicated `auth_audit_logs` table, written by application code at four points: login success, login failure (including which of "bad credentials" vs. "locked/inactive" it was, for internal diagnostics only — never returned to the client beyond the FR-005/FR-014 distinction), logout, and the moment an account transitions to `locked`.
- **Rationale**: `001`'s generic `audit_logs` trigger pattern fires on row-level mutations to business-critical tables, which naturally covers things like "a `users` row's `status` changed." But a login *failure* and a *logout* are not row mutations at all (a failed login before lockout doesn't necessarily change any persisted row other than incrementing a counter, and a logout only touches `refresh_tokens`, not `users`) — an event that isn't a row mutation needs an explicit application-level write to be auditable at all, satisfying FR-018.
- **Alternatives considered**: Extending the generic `audit_logs` table with an `entity_type = 'auth_event'` row instead of a dedicated table — workable, but conflates two different audit shapes (a before/after row diff, vs. a plain security event with no "before" state); a dedicated table keeps both audit consumers simple.

## 7. Session/device metadata

- **Decision**: Each `refresh_tokens` row stores `user_agent` and `ip_address` captured at issuance, purely for the security audit trail (FR-018) and to make a future "recent sessions" UI possible later — not used to enforce any device limit in this feature (spec Assumption: multiple concurrent sessions are explicitly allowed, FR-016).
- **Rationale**: Cheap to capture at issuance time and materially useful if a reuse-detection event (research.md §4) ever needs investigating ("which device/IP did the stolen token get used from").
- **Alternatives considered**: Capturing nothing — rejected, since it would make a theft-detection event (FR-017) unfollow-up-able; there would be no way to tell which of a user's sessions was the compromised one.

## Outstanding NEEDS CLARIFICATION

None. The spec's one clarification (failed-login lockout threshold/unlock mechanism) was already resolved during `/speckit-specify` (FR-012: 5 attempts, unlock via forgot-password reset only).
