# Tasks: Registration & Login with JWT Authentication

**Input**: Design documents from `/specs/002-registration-login-jwt-auth/` (spec.md, plan.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md)

**Tests**: Included — `plan.md`'s Testing section commits to Jest + Supertest contract tests per endpoint plus a token-lifecycle unit suite; tasks below follow that.

**Organization**: Tasks are grouped by user story (spec.md priorities P1/P1/P2/P2/P3) so each story is independently implementable and testable.

## Pre-existing foundation (from `001-company-role-user-setup`, not re-built here)

- `api/src/common/guards/jwt-auth.guard.ts` + `guards.module.ts` already verify a Bearer access token via `@nestjs/jwt`'s `JwtService` (registered with `JWT_SECRET`/`JWT_ACCESS_TOKEN_TTL_SECONDS`) — this feature only adds **issuing** tokens (login/refresh) on top of that existing verifier; do not duplicate JWT verification.
- `argon2` is already a dependency; `users.password_hash` / `status` / `no_of_login_attempt` columns already exist (data-model.md "Relevant columns already on `users`").
- `TenantPrismaService.runInTenantContext()` is the *only* sanctioned DB access path (coding_standard.md §4.3) — every task touching `refresh_tokens`/`auth_audit_logs`/`users` MUST go through it, never inject `PrismaClient` directly. Pre-authentication paths (login lookup, refresh-token lookup) have no JWT yet, so they run with `{ role: 'system_actor', systemActor: 'auth-service' }`-style context, not a real user's claims — see `research.md` and the RLS policy in `data-model.md`.
- **Known gap, out of scope here**: `001`'s Student self-registration HTTP endpoint (the thing that actually creates a `users` row) has not been built yet (only System Admin's Company CRUD exists under `api/src/companies/`). FR-001/User Story 1 below therefore delivers the reusable session-issuance contract that endpoint must call once `001` finishes it — it does not build that endpoint itself (spec.md Assumptions: "Scope boundary with account creation").

## Phase 1: Setup

- [x] T001 Add `JWT_REFRESH_TOKEN_TTL_DAYS` (default `14`) and `ACCOUNT_LOCK_THRESHOLD` (default `5`) to the env schema in `api/src/common/config/env.validation.ts`, and document both in `api/.env.example` (spec.md Assumption "Credential lifetimes", FR-012)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: DB schema + pure-crypto services every user story below depends on.

**⚠️ CRITICAL**: No user story task may begin until this phase is complete.

- [x] T002 Add `RefreshToken` and `AuthAuditLog` models to `api/prisma/schema.prisma` per `data-model.md` §1–2 (fields, FKs to `User`, `replaced_by` self-reference on `RefreshToken`)
- [x] T003 Write the Prisma migration adding `refresh_tokens` + `auth_audit_logs` tables in `api/prisma/migrations/<timestamp>_auth_sessions/migration.sql`, hand-adding (per coding_standard.md §4.2, matching `001`'s migration): unique index on `token_hash`, index on `(user_id, revoked_at)`, RLS `ENABLE ROW LEVEL SECURITY` + the `self_or_system_admin` policy from `data-model.md`, and the equivalent company-scoped policy for `auth_audit_logs`
- [x] T004 [P] Implement `PasswordService` (Argon2id hash/verify wrapper) in `api/src/auth/password.service.ts` (research.md §1)
- [x] T005 [P] Implement `TokenService` in `api/src/auth/token.service.ts`: `signAccessToken({sub, role, company_id})` via the existing `JwtService` (jti + iat/exp per contracts/openapi.yaml `Session.access_token`), `generateRefreshToken()` returning `{raw, hash}` (`crypto.randomBytes` + SHA-256 per research.md §3) — pure crypto only, no DB access
- [x] T006 [P] Implement `AuthAuditService` in `api/src/auth/auth-audit.service.ts` — one method per `auth_audit_logs.event_type` value (`login_success`, `login_failed_bad_credentials`, `login_failed_locked`, `login_failed_inactive`, `logout`, `account_locked`, `refresh_reuse_detected`), writing via `TenantPrismaService` (research.md §6)
- [x] T007 Create `AuthModule` in `api/src/auth/auth.module.ts` wiring `PasswordService`/`TokenService`/`AuthAuditService`, importing `GuardsModule` (reuses its `JwtModule`) and `PrismaModule`; register `AuthModule` in `api/src/app.module.ts`

**Checkpoint**: Schema migrated, pure-crypto services and module wiring exist — user story work can begin.

---

## Phase 3: User Story 1 - Student Registration Starts an Authenticated Session (Priority: P1) 🎯 MVP

**Goal**: A freshly created account is handed back a working session with no separate login call (FR-001).

**Independent Test**: Given a `users` row (however it was created), calling the session-issuance path returns an access+refresh token pair, and the access token immediately authorizes a request scoped to that user's own company/role.

- [x] T008 [US1] Implement `AuthService.issueSession(user, meta)` in `api/src/auth/auth.service.ts` — persists a new `refresh_tokens` row via `TenantPrismaService` (using `TokenService.generateRefreshToken()`'s hash) and returns `AuthenticatedUserResponse` shape (`user` summary + `Session`) per contracts/openapi.yaml; this is the single method both the future `001` registration endpoint and this feature's own login (US2) call to hand back a session
- [x] T009 [US1] Contract test in `api/test/contract/auth/register-issues-session.spec.ts`: seed a `users` row directly (fixture — `001`'s real `/auth/register` HTTP endpoint doesn't exist yet, see "Known gap" above), call `issueSession`, assert the returned access token's claims (`sub`, `role`, `company_id`) match the seeded user and that an immediate authenticated request (e.g. a protected test route) scoped to that company/role succeeds with zero extra login calls (FR-001, FR-006, SC-001)

**Checkpoint**: Session issuance is proven independently of whichever endpoint eventually calls it.

---

## Phase 4: User Story 2 - Returning User Logs In (Priority: P1)

**Goal**: Any existing role logs in with username/password (+ `company_id` for non-system_admin roles, per spec.md Clarifications 2026-09-06) and gets a working session; wrong credentials and locked/inactive accounts are rejected with the right distinct error.

**Independent Test**: Correct credentials → usable session; wrong username/password/company → single generic error; locked/inactive → distinct error.

- [x] T010 [P] [US2] `LoginDto` (`username`, `password`, optional `company_id`) with `class-validator` decorators in `api/src/auth/dto/login.dto.ts`
- [x] T011 [US2] Implement `AuthService.login(dto, meta)` in `api/src/auth/auth.service.ts`: look up the user by `(company_id, username)` for a company-scoped role or by `username` alone (`company_id IS NULL`) for `system_admin` (research.md §5/§5a); if not found — including a username that exists only under a *different* `company_id` — treat identically to a bad password (FR-005); if found, check `status` first and short-circuit with the distinct locked/inactive error before touching the password (FR-014, research.md §5); otherwise verify the password (`PasswordService`), on failure increment `no_of_login_attempt` and lock (`status = 'locked'`, revoke all sessions, `account_locked` audit event) at `ACCOUNT_LOCK_THRESHOLD` (FR-012, FR-015); on success reset the counter to 0 (FR-013), write `login_success`, and call `issueSession` (T008)
- [x] T012 [US2] `AuthController`: `POST /auth/login` in `api/src/auth/auth.controller.ts` mapping `AuthService.login` outcomes to `200`/`401`/`403` per contracts/openapi.yaml
- [x] T013 [P] [US2] Contract tests in `api/test/contract/auth/login.spec.ts`: success for each of the 4 roles; unknown username, wrong password, and username-exists-at-different-company_id all produce the identical generic `401` (FR-005); locked and inactive both produce the distinct `403` even with the correct password (FR-014); `no_of_login_attempt` resets to 0 after success (FR-013); login succeeds for a Student whose Company has `is_open: false` (spec.md User Story 2 scenario 4) (FR-002 thru FR-005, FR-013, FR-014, SC-001, SC-003)

**Checkpoint**: Login works end-to-end for all four roles, independent of US1.

---

## Phase 5: User Story 3 - Session Stays Active Without Re-Entering Credentials (Priority: P2)

**Goal**: A valid refresh token silently mints a new access token; rotation + reuse detection protect against a stolen refresh token.

**Independent Test**: Valid refresh token → new session, old refresh token now dead; expired/revoked/unrecognized refresh token → rejected, re-login required; replaying an already-rotated token revokes every session for that user; two devices renew independently.

- [x] T014 [US3] Implement `AuthService.refresh(rawRefreshToken, meta)` in `api/src/auth/auth.service.ts`: hash the presented token and look it up; if not found, or `revoked_at IS NOT NULL`, or `expires_at <= now()` → reject per FR-010, **except** when the row is found with `revoked_at IS NOT NULL` for reasons other than "not yet found" (i.e. a legitimate already-rotated token being replayed) — in that specific case treat as reuse: revoke every `refresh_tokens` row for that `user_id` and write `refresh_reuse_detected` (FR-017); on a valid token, rotate it (mark `revoked_at`/`replaced_by`, issue a new pair via T008-style logic) and return the new `Session` (FR-008, FR-009, research.md §4)
- [x] T015 [US3] `AuthController`: `POST /auth/refresh` in `api/src/auth/auth.controller.ts` per contracts/openapi.yaml
- [x] T016 [P] [US3] Unit tests for the rotation chain and reuse detection, independent of the HTTP layer, in `api/test/unit/token-rotation/rotation.spec.ts` (FR-017, FR-019, research.md §4)
- [x] T017 [P] [US3] Contract tests in `api/test/contract/auth/refresh.spec.ts`: success issues a new working pair; expired/revoked/malformed token all rejected identically; two independently-issued sessions for the same user renew without affecting each other (FR-008 thru FR-010, FR-016, SC-002)

**Checkpoint**: Long-lived sessions work without re-login, with theft detection in place.

---

## Phase 6: User Story 4 - Repeated Failed Logins Protect the Account (Priority: P2)

**Goal**: The lockout mechanics already built into `login` (T011) are proven from the account-protection angle, and cascading revocation on lock is verified explicitly.

**Independent Test**: 5 consecutive failures locks the account; a 6th attempt with the *correct* password is still rejected with the locked message; any session active at the moment of lock loses its refresh token immediately.

- [x] T018 [US4] Extract/confirm a shared `AuthService.revokeAllSessions(userId)` helper (used by T011's lock path) that revokes every non-revoked `refresh_tokens` row for a user in one operation — `api/src/auth/auth.service.ts` (FR-015)
- [x] T019 [P] [US4] Contract tests in `api/test/contract/auth/lockout.spec.ts`: exactly 5 consecutive bad-password attempts locks the account; the correct password on a locked account is still rejected with the locked-specific (not generic) message; a refresh token issued just before lock can no longer be used to refresh immediately after lock, while an already-issued access token keeps working until its own natural expiry (FR-012 thru FR-015, SC-004)

**Checkpoint**: Brute-force protection is independently verified.

---

## Phase 7: User Story 5 - User Logs Out (Priority: P3)

**Goal**: A signed-in user can end their own session; other sessions/devices are unaffected.

**Independent Test**: Logout revokes only that session's refresh token; a second device's session keeps working; the just-used access token still authenticates once more until natural expiry but can no longer refresh.

- [x] T020 [US5] Implement `AuthService.logout(rawRefreshToken)` in `api/src/auth/auth.service.ts` — revoke the matching `refresh_tokens` row by hash and write a `logout` audit event (FR-011, FR-018)
- [x] T021 [US5] `AuthController`: `POST /auth/logout` (behind the existing `JwtAuthGuard`) in `api/src/auth/auth.controller.ts`, `204` on success per contracts/openapi.yaml
- [x] T022 [P] [US5] Contract tests in `api/test/contract/auth/logout.spec.ts`: logout revokes only the targeted session; a second device's session is unaffected; the logged-out session's access token still authorizes one more request before natural expiry but its refresh token can no longer renew (FR-011, FR-019, SC-005)

**Checkpoint**: All five user stories independently pass.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T023 [P] Expose `AuthService.revokeAllSessions(userId, exceptRefreshTokenId?)` (generalizing T018) as the hook FR-020 requires for password-change/forgot-password-reset to call — no caller yet since both trigger points belong to future features (`003-forgot-password-otp-reset` and change-password), document that explicitly in a short comment — `api/src/auth/auth.service.ts`
- [x] T024 [P] RLS isolation tests for `refresh_tokens`/`auth_audit_logs` extending `api/test/rls/tenant-isolation.spec.ts`: a user can only see/revoke their own refresh tokens; a Company Admin can read `auth_audit_logs` rows only for their own company; System Admin has the platform-wide bypass (data-model.md "Row Level Security")
- [x] T025 [P] Add `POST /auth/login`, `/auth/refresh`, `/auth/logout` requests to `api/postman/GenzFeast-API.postman_collection.json`
- [x] T026 Run every scenario in `specs/002-registration-login-jwt-auth/quickstart.md` end-to-end against a local run of the API; fix any drift found
- [ ] T027 [P] Wire `mobile/src/screens/student/LoginScreen.tsx` to call `POST /auth/login` (passing its build's `company_id`) and store the returned tokens — **migrate `mobile/src/api/client.ts` off `AsyncStorage` onto secure storage (Keychain/Keystore) for both tokens**, since it currently stores the access token in plain `AsyncStorage` (fine for the dev-only `mint-dev-jwt` placeholder, but plan.md explicitly requires Keychain/Keystore — "never AsyncStorage" — once this feature makes real, long-lived refresh tokens flow through it); add transparent refresh-on-401 — `mobile/src/api/client.ts`, `mobile/src/screens/student/LoginScreen.tsx`

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)**: blocks every user story.
- **US1 (Phase 3)**: needs Phase 2 only. Delivers `issueSession`, which **US2 depends on directly** (T011 calls T008).
- **US2 (Phase 4)**: needs Phase 2 + T008 (US1). Independently testable once T008 exists.
- **US3 (Phase 5)**: needs Phase 2 + a way to issue tokens (T008/T011) to have something to refresh; otherwise independent of US2/US4/US5's own logic.
- **US4 (Phase 6)**: needs T011's lockout logic (US2) already in place — this phase adds the cascading-revocation guarantee and its own tests on top.
- **US5 (Phase 7)**: needs a live session to log out of (T008/T011) but its own logic (T020-T022) is independent of US3/US4.
- **Polish (Phase 8)**: after all desired stories are done; T023 only needs T018 (US4).

### Parallel Opportunities

- Phase 2: T004, T005, T006 (different files, no cross-dependency).
- Within each user story phase, the `[P]`-marked test files can run in parallel once that phase's implementation tasks are done.
- T024, T025, T027 in Phase 8 can run in parallel with each other and with T023/T026.

## Implementation Strategy

**MVP first**: Phase 1 → Phase 2 → Phase 3 (US1) → Phase 4 (US2) gives working registration-session-issuance + login, the two P1 stories — stop and validate here before continuing.

**Incremental delivery**: add Phase 5 (US3, refresh) next since nothing else is usable for more than ~30 minutes without it, then Phase 6 (US4, lockout hardening), then Phase 7 (US5, logout), then Phase 8 (polish, including the mobile wiring and the AsyncStorage→Keychain fix called out in T027).
