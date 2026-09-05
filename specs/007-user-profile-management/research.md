# Phase 0 Research: User Profile (View, Edit, Change Password)

**Feature**: `007-user-profile-management` | **Date**: 2026-09-05

Depends on `001-company-role-user-setup` (`users`/`companies`/`departments`/`categories`) and `002-registration-login-jwt-auth` (password hashing, refresh-token revocation). This is the first feature that requires **no new table and no migration** — it is purely a read/edit surface over columns that already exist. This document resolves the remaining implementation-pattern questions.

## 1. No schema changes needed

- **Decision**: This feature adds zero tables and zero columns. `users.name`, `users.username`, `users.email`, `users.category_id`, `users.department_id`, and `users.company_id` (all from `001`) are sufficient for every field in the spec.
- **Rationale**: Every field the spec calls for (Name, Username, Email, Category, Department, Company) already exists on `users` per `001`'s data model. Name and Username are simply never written to by this feature (FR-003/FR-008); Category is read but never written (FR-005). No new persistence concept is introduced.
- **Alternatives considered**: N/A — there was nothing to design here beyond confirming the existing schema already covers every requirement.

## 2. Identifying "this session" for password-change session revocation

- **Decision**: `POST /me/change-password` accepts an optional `refresh_token` field in its body — the same session-identification pattern `002`'s own `/auth/logout` already uses (which also requires the refresh token in its body despite being Bearer-authenticated, precisely to know *which* session to act on). If provided and it matches an active session for the caller, that one session's refresh token is preserved; every other active refresh token for the account is revoked. If omitted, **all** sessions (including the current one) are revoked — the safer default, consistent with how `003`'s password-reset flow (which has no "current session" concept at all, since it's unauthenticated) already revokes everything unconditionally.
- **Rationale**: An access token's claims (`sub`, `role`, `company_id`, `iat`, `exp`, `jti` per `002`'s design) do not include a reference back to the specific refresh token that spawned it, so the backend has no way to identify "the session making this request" from the access token alone. Reusing the logout endpoint's existing pattern (client resends its own refresh token to self-identify) avoids inventing a second mechanism for the same underlying problem.
- **Alternatives considered**: Adding a session/refresh-token-id claim to the access token JWT — would solve this more elegantly, but is a change to `002`'s already-decided token shape that this feature has no standing reason to force; the body-parameter approach reuses an existing, proven pattern instead.

## 3. Validating a Student's submitted Department belongs to their own Company

- **Decision**: `PATCH /me/profile`'s department update looks up the submitted `department_id` scoped to the caller's own `company_id` (the same query shape `001` already uses for listing a company's departments) before accepting it. A `department_id` that doesn't resolve under that scope — whether it doesn't exist at all or belongs to a different Company — is rejected identically, the same way `001` already prevents cross-tenant references.
- **Rationale**: No new isolation mechanism is needed; this is a direct reuse of `001`'s existing tenant-scoping query pattern and RLS, applied to one more write path.
- **Alternatives considered**: N/A — this is a direct application of an already-established pattern, not a new decision.

## 4. Auditing profile edits vs. password-change failures

- **Decision**: A successful profile edit (Email/Department change) is a plain `UPDATE` on `users` — it's covered by the platform's general "every mutation of a business-critical table is audited" principle (referenced narratively across every prior feature spec, e.g. `001`'s FR-017, `004`'s FR-011) once that platform-wide mechanism exists; this feature does not need to build anything new for that case. A **failed** password-change attempt (wrong current password) is, like a failed login (`002`) or a failed OTP verification (`003`/`005`), *not* a row mutation — so it needs an explicit application-level write to be auditable at all. This feature extends `002`'s existing `auth_audit_logs` table with two new event types: `password_change_succeeded` and `password_change_failed`.
- **Rationale**: Reuses the exact reasoning `002` (research.md §6) and `003` (research.md §3) already established for "a failed attempt needs an explicit log because no row changed" — and reuses `auth_audit_logs` itself (rather than inventing a third audit table) since a password-change failure is squarely a credential-verification security event, the same category `auth_audit_logs` already exists to hold.
- **Alternatives considered**: A dedicated `profile_audit_logs` table — rejected as unnecessary; unlike `005`'s order-fulfilment events (a genuinely different domain from authentication), a password-change failure is exactly the same kind of event `auth_audit_logs` was built for.

## 5. Email format validation

- **Decision**: Standard email-format validation (e.g., a `class-validator` `@IsEmail()`-equivalent check) at the DTO layer — no custom validation logic beyond what's already standard for the framework.
- **Rationale**: Nothing in the spec calls for anything beyond well-formedness checking (FR-006); there's no domain-specific email rule (e.g., restricting to a college's own email domain) mentioned anywhere in the source documents.
- **Alternatives considered**: Restricting Email to the student's college domain — rejected; no source document suggests this, and registration itself (`001`) never imposed such a restriction either.

## Outstanding NEEDS CLARIFICATION

None. The spec's one clarification (Name editability) was already resolved during `/speckit-specify` (FR-008: read-only).
