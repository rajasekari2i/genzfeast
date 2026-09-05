# Implementation Plan: Forgot Password Flow (OTP-Based Reset)

**Branch**: `003-forgot-password-otp-reset` | **Date**: 2026-09-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-forgot-password-otp-reset/spec.md`

## Summary

Add self-service password recovery on top of `001`'s account model and `002`'s session/lockout mechanics: a user submits their username to receive a 6-character alphanumeric one-time code (delivered via Firebase Cloud Messaging push, with an always-available in-app fallback display so a missed notification never blocks recovery); the request endpoint responds identically whether or not the username exists, to prevent account enumeration; the code is single-use, time-limited, and invalidated after too many incorrect guesses or by any newer request superseding it; and a successful verify updates the password, resets the shared failed-attempt counter (unlocking a `locked` account — its only self-service unlock path), and revokes every other active session for that account. No new tables are introduced — this feature adds three columns to `001`'s `users` table and three new event types to `002`'s `auth_audit_logs` table.

## Technical Context

**Language/Version**: TypeScript (Node.js 20 LTS) for the API — unchanged from `001`/`002`

**Primary Dependencies**: NestJS (reused); Node's built-in `crypto` for generating the 6-character alphanumeric code and SHA-256-hashing it before storage (research.md §1–§2, mirroring `002`'s refresh-token hashing pattern); the existing Firebase Cloud Messaging integration (Architecture §8) for push delivery — no new push provider

**Storage**: Supabase-managed PostgreSQL — additive migration on `001`'s `users` table (3 new columns) plus 3 new `event_type` values written into `002`'s existing `auth_audit_logs` table; no new tables (research.md §1, §3)

**Testing**: Jest + Supertest for `/auth/forgot-password/*` contract tests (request-response-identity, verify success/expired/wrong-code/attempt-limit/mismatch-passwords); a timing-consistency check for the anti-enumeration behavior (research.md §5) to catch a response-time side-channel that a body-only test would miss

**Target Platform**: Same containerized Node.js API as `001`/`002`; no new client platform

**Performance Goals**: Same <300ms perceived-latency NFR as the rest of the platform; the anti-enumeration design (research.md §5) requires the "account not found" path to do comparable work to the "account found" path, which is a deliberate, small latency cost accepted for the security property

**Constraints**: The request endpoint MUST NOT return different status codes, bodies, or observably different timing for an existing vs. non-existing username (FR-004); a code MUST be usable at most once and only within its expiry window and attempt limit (FR-013–FR-015); a successful reset MUST cascade into `002`'s session-revocation and counter-reset mechanics (FR-010–FR-011), not duplicate them

**Scale/Scope**: Same tenant/user scale as `001`/`002`; this flow is used far less frequently than login (only when a user is actually locked out), so it carries no special throughput requirement beyond the shared NFR

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

As in `001`/`002`, `.specify/memory/constitution.md` remains an unfilled template. `docs/product/01-BRD.md` §5/§7/§8 (forgot-password scope, the two-distinct-OTP-flows assumption, and the login-attempt business rule) and `docs/architecture/04-Architecture.md` §8 (Notification Flow) govern this feature directly. Checked against those:

- Forgot-password OTP is alphanumeric and delivered via FCM only, distinct from the numeric order OTP (BRD Assumption 6). ✅
- In-app fallback display exists so notification-delivery failure never blocks the flow (BRD §9 Risk row). ✅
- `no_of_login_attempt` increments on every forgot-password request and resets only after a successful reset (BRD Business Rule 6). ✅
- OTP has an expiry (PRD's own data-model note: "OTPs must expire... required for security"). ✅
- No new Firebase product introduced beyond the already-approved FCM. ✅

**Result**: PASS. No entries required in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/003-forgot-password-otp-reset/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── openapi.yaml      # Phase 1 output (/speckit-plan command)
└── tasks.md               # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

Extends the `api/` structure from `001`/`002`. No new top-level directories; this feature lives inside the existing `auth/` module from `002`.

```text
api/
├── src/
│   ├── auth/
│   │   ├── auth.controller.ts        # (002) + new: POST /auth/forgot-password/request, /verify
│   │   ├── auth.service.ts            # (002) + new: password-reset request/verify logic (research.md §1, §4, §5)
│   │   ├── password.service.ts        # (002, reused) Argon2id hash/verify — also hashes the new password on reset
│   │   ├── token.service.ts           # (002, reused) — invoked to revoke all sessions on successful reset (FR-011)
│   │   ├── auth-audit.service.ts      # (002) + new event_type values: password_reset_requested/succeeded/failed_verification
│   │   └── otp.service.ts             # new: generate 6-char alphanumeric code, SHA-256 hash it, check expiry/attempt-limit
│   └── notifications/
│       └── fcm.service.ts              # existing FCM integration (Architecture §8) — sends the reset-code push
├── migrations/
│   └── ...                              # 3 new columns on users (data-model.md)
└── test/
    └── contract/
        └── forgot-password/             # request-identity, verify success/failure contract tests

mobile/
└── src/
    └── screens/
        └── auth/
            ├── ForgotPasswordRequest.tsx  # UI Design §4.3 — username field, "Click to Verify" CTA
            └── ForgotPasswordVerify.tsx    # UI Design §4.4 — code (with in-app fallback display), New Password, Retype Password
```

**Structure Decision**: All new backend logic lives inside the `auth/` module `002` already established, since this is the same bounded concern (account credential recovery) as login/session management — no new module boundary is warranted for three endpoints and three new columns. Mobile screens are additive under the same `auth/` screen grouping.

## Complexity Tracking

*No Constitution Check violations — this section is intentionally empty.*
