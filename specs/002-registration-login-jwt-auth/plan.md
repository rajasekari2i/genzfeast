# Implementation Plan: Registration & Login with JWT Authentication

**Branch**: `002-registration-login-jwt-auth` | **Date**: 2026-09-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-registration-login-jwt-auth/spec.md`

## Summary

Add the authentication layer on top of the account model established by `001-company-role-user-setup`: password verification against securely hashed credentials, immediate session issuance on Student self-registration, username/password login for every role, short-lived stateless JWT access tokens carrying identity/role/company claims, longer-lived database-tracked and rotating refresh tokens with reuse (theft) detection, account lockout after 5 consecutive failed logins (unlockable only via the out-of-scope forgot-password reset), explicit single-session logout, and cascading session revocation on lock/deactivation/password-change events. The approach reuses `001`'s NestJS/Supabase-Postgres/RLS foundation and adds two new tables (`refresh_tokens`, `auth_audit_logs`) plus four endpoints (`/auth/register`'s response extended, `/auth/login`, `/auth/refresh`, `/auth/logout`).

## Technical Context

**Language/Version**: TypeScript (Node.js 20 LTS) for the API — unchanged from `001`

**Primary Dependencies**: NestJS (reused from `001`); `argon2` for password hashing (research.md §1); `jsonwebtoken` for HS256 JWT sign/verify (research.md §2); Node's built-in `crypto` (`randomBytes` + `createHash('sha256')`) for opaque refresh tokens (research.md §3); `class-validator`/`class-transformer` for DTOs

**Storage**: Supabase-managed PostgreSQL, extending `001`'s schema with `refresh_tokens` and `auth_audit_logs` (both RLS-enabled)

**Testing**: Jest + Supertest for `/auth/*` contract tests (login success/failure/lockout, refresh success/expired/revoked/reuse, logout); a token-lifecycle-focused suite covering rotation chains and mass-revocation-on-reuse, independent of any single endpoint test

**Target Platform**: Same containerized Node.js API as `001`; no new client platform

**Performance Goals**: Login/refresh/logout should feel instant (<300ms perceived, same NFR as `001`); Argon2id parameters tuned to balance brute-force resistance against acceptable p95 login latency (a tuning detail for implementation, not a spec-level constraint)

**Constraints**: Access tokens MUST remain stateless (no DB lookup to validate one — Architecture §4.1); refresh tokens MUST be individually revocable and MUST rotate on use with reuse detection (research.md §4); passwords MUST use Argon2id, never plaintext or a reversible encoding; the two login-failure error paths (generic vs. locked/inactive) MUST stay distinguishable per FR-005/FR-014

**Scale/Scope**: Same tenant/user scale as `001` (a handful to low tens of Companies, each with hundreds to low thousands of Students); auth traffic (login/refresh) is the highest-frequency traffic this platform has, since every access-token expiry (~30 min) triggers a refresh for every active session

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

As in `001`, `.specify/memory/constitution.md` remains an unfilled template; `docs/architecture/04-Architecture.md` §4 (Authentication) and §10 (Non-Functional/Cross-Cutting) plus `docs/product/01-BRD.md` §7 Assumption 7 govern this feature directly, since they specifically mandate the stateless-JWT-plus-revocable-refresh-token design this plan implements. Checked against those:

- Stateless JWT access token + DB-tracked revocable refresh token — not session cookies, not Supabase Auth, not Firebase Auth (BRD Assumption 7, Architecture §4). ✅
- Passwords hashed, never plaintext (PRD §4 NFR). ✅
- `no_of_login_attempt` / account-lock checked before token issuance (Architecture §4.3). ✅
- Auditable: every login/logout/lock event recorded (PRD §4 NFR, Architecture §10). ✅
- Short access-token lifetime bounding the "cannot revoke a stateless token before expiry" risk (BRD §9 Risk row). ✅

**Result**: PASS. No entries required in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/002-registration-login-jwt-auth/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── openapi.yaml      # Phase 1 output (/speckit-plan command)
└── tasks.md               # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

Extends the `api/` structure established by `001` (see that feature's `plan.md`). No new top-level directories.

```text
api/
├── src/
│   ├── auth/
│   │   ├── auth.controller.ts     # POST /auth/login, /auth/refresh, /auth/logout; extends /auth/register's response
│   │   ├── auth.service.ts         # credential verification, token issuance/rotation, lockout logic (research.md §1, §4, §5)
│   │   ├── password.service.ts     # Argon2id hash/verify wrapper
│   │   ├── token.service.ts        # JWT sign/verify (access) + opaque token generation/hashing (refresh)
│   │   └── auth-audit.service.ts   # writes to auth_audit_logs (research.md §6)
│   ├── users/                       # from 001 — extended to call auth.service on registration (FR-001)
│   └── common/
│       └── guards/
│           └── jwt-auth.guard.ts    # verifies Authorization: Bearer <access_token>, populates request.auth {sub, role, company_id}
├── migrations/
│   └── ...                          # refresh_tokens, auth_audit_logs tables + RLS policies (data-model.md)
└── test/
    ├── contract/
    │   └── auth/                    # login, refresh, logout, register-issues-session contract tests
    └── unit/
        └── token-rotation/          # rotation-chain and reuse-detection tests, independent of HTTP layer

mobile/
└── src/
    └── services/
        └── api/
            └── authClient.ts         # stores access/refresh tokens in Keychain/Keystore (never AsyncStorage), attaches Authorization header, calls /auth/refresh transparently on 401
```

**Structure Decision**: The auth logic lives in a new `api/src/auth/` module alongside `001`'s `users/companies/roles/categories/departments` modules, following the same one-module-per-concern NestJS layout `001` established (research.md §1 there). No mobile app-shell decisions are revisited here — `authClient.ts` is additive to whatever mobile scaffolding `001`/future features establish.

## Complexity Tracking

*No Constitution Check violations — this section is intentionally empty.*
