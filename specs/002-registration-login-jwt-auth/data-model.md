# Phase 1 Data Model: Registration & Login with JWT Authentication

**Feature**: `002-registration-login-jwt-auth` | **Date**: 2026-09-05

Builds directly on the `users` table defined in `specs/001-company-role-user-setup/data-model.md` (which already carries `password_hash`, `status`, `no_of_login_attempt`). This feature adds the tables needed to track sessions and auth-specific audit events; it does not redefine `companies`, `roles`, `categories`, `departments`, or `users`.

## Entity Relationship Overview

```
users (1) ──< refresh_tokens (many — one row per active/past session)
users (1) ──< auth_audit_logs (many — one row per login/logout/lock event)
refresh_tokens (1) ──0..1 refresh_tokens (self-reference: replaced_by, for rotation chains)
```

## 1. `refresh_tokens`

| Column | Type | Constraints / Notes |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `user_id` | `uuid` | not null, references `users(id)` |
| `token_hash` | `text` | not null — SHA-256 hex digest of the opaque raw token; the raw token itself is never stored (research.md §3) |
| `issued_at` | `timestamptz` | not null, default `now()` |
| `expires_at` | `timestamptz` | not null — `issued_at` + refresh-token lifetime (spec Assumption: ~14 days) |
| `revoked_at` | `timestamptz` | nullable — set on logout (FR-011), rotation (research.md §4), account lock/deactivation (FR-015), password change (FR-020), or reuse-detected mass revocation (FR-017) |
| `replaced_by` | `uuid` | nullable, references `refresh_tokens(id)` — set when this token was rotated into a new one |
| `user_agent` | `text` | nullable — captured at issuance (research.md §7) |
| `ip_address` | `text` | nullable — captured at issuance |
| `created_at` | `timestamptz` | not null, default `now()` |

**Constraints**:
- Unique index on `token_hash` — two sessions can never collide on the same hash (astronomically unlikely, enforced defensively).
- Index on `(user_id, revoked_at)` — the hot lookup path for "does this user have any active sessions to revoke" (lock, deactivation, password change) and "list a user's active sessions."

**Validity rule** (enforced in the API layer at every `/auth/refresh` call, not just via column constraints): a refresh token is usable only when `revoked_at IS NULL AND expires_at > now()`. Any other state (revoked, expired, or simply not found by hash) is rejected identically per FR-010.

## 2. `auth_audit_logs`

| Column | Type | Constraints / Notes |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `user_id` | `uuid` | nullable, references `users(id)` — null when the attempted username did not resolve to any account |
| `company_id` | `uuid` | nullable, references `companies(id)` — denormalized from the user at event time, so a query can be scoped per tenant without joining `users` for every row |
| `event_type` | `text` | not null — one of `login_success`, `login_failed_bad_credentials`, `login_failed_locked`, `login_failed_inactive`, `logout`, `account_locked`, `refresh_reuse_detected` |
| `refresh_token_id` | `uuid` | nullable, references `refresh_tokens(id)` — set for `logout` and `refresh_reuse_detected` events |
| `ip_address` | `text` | nullable |
| `user_agent` | `text` | nullable |
| `created_at` | `timestamptz` | not null, default `now()` |

**Rationale for a dedicated table vs. the generic `audit_logs` trigger pattern from `001`**: see research.md §6 — several of these events are not row mutations at all (or mutate a row in a way that doesn't tell the whole story, e.g. a failed login before lockout only increments a counter), so they need an explicit application-level write rather than a trigger.

This table is append-only from the application's perspective — no update/delete path is defined for it in this feature.

## Relevant columns already on `users` (from `001`, reused here — not redefined)

| Column | Used by this feature for |
|---|---|
| `password_hash` | FR-003 verification target (Argon2id per research.md §1) |
| `status` (`active`\|`inactive`\|`locked`) | FR-014 gate, checked before password verification per research.md §5 |
| `no_of_login_attempt` | FR-012/FR-013 consecutive-failure counter; reset to 0 on success, incremented on `login_failed_bad_credentials`, triggers lock at 5 |

## Row Level Security

`refresh_tokens` and `auth_audit_logs` are scoped by `user_id` (and, for `auth_audit_logs`, by the denormalized `company_id`) using the same `app.current_user_id` / `app.current_company_id` / `app.current_role` session variables established in `001` (research.md §2): a user can only ever see/revoke their own refresh tokens; a Company Admin can view `auth_audit_logs` rows for users within their own `company_id` (for investigating a suspicious lock event); System Admin has the usual platform-wide bypass.

```sql
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY self_or_system_admin ON refresh_tokens
  FOR ALL USING (
    user_id = current_setting('app.current_user_id', true)::uuid
    OR current_setting('app.current_role', true) = 'system_admin'
  );
```

`auth_audit_logs` uses an equivalent policy keyed on `company_id` (readable by that company's Company Admin and System Admin; not writable by any role via the API — only the backend's own service-level insert path writes to it).

## State Transitions

**Refresh token lifecycle**:
```
issued → (used successfully) → revoked (replaced_by = new token id)
issued → (logout) → revoked (replaced_by = NULL)
issued → (account locked/deactivated, or password changed elsewhere) → revoked (replaced_by = NULL)
issued → (natural expiry reached) → implicitly unusable (expires_at check), no row change required
revoked → (presented again) → reuse detected: every other active token for user_id is also revoked
```

**Account status, as it interacts with login** (status itself is owned by `001`; this feature only reads/reacts to it and drives the `locked` transition):
```
active --(5th consecutive failed login)--> locked
locked --(forgot-password reset succeeds, out of this feature's scope)--> active (no_of_login_attempt reset to 0)
```
