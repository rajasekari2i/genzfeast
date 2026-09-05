# Implementation Plan: User Profile (View, Edit, Change Password)

**Branch**: `007-user-profile-management` | **Date**: 2026-09-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-user-profile-management/spec.md`

## Summary

Give every role a role-aware Profile screen on top of `001` (users/companies/departments) and `002` (auth/session revocation): view own Name/Username/Email plus role-appropriate context (Category/Department for Students, Company for Company Admin/Staff); edit Email (all roles) and Department (Students only, validated against their own Company); and change password (current + new + confirm), which revokes every other active session on success. This feature requires **no new table or migration** — it is the first feature that's purely a read/write surface over already-existing columns, plus two new event types on `002`'s existing `auth_audit_logs`.

## Technical Context

**Language/Version**: TypeScript (Node.js 20 LTS) for the API — unchanged from prior features

**Primary Dependencies**: NestJS (reused); `class-validator` `@IsEmail()`-equivalent for email format validation; `argon2` (reused from `002`) for current-password verification and new-password hashing

**Storage**: Supabase-managed PostgreSQL — no schema changes; reads/writes existing `users` columns, writes new event types into `002`'s `auth_audit_logs` (data-model.md)

**Testing**: Jest + Supertest for `/me/profile` and `/me/change-password` contract tests (role-shaped view, all-or-nothing edit, cross-tenant department rejection, password-change session-preservation logic)

**Target Platform**: Same containerized Node.js API as prior features; mobile screens per UI Design §4.10–§4.12 (Profile, Edit Profile, Change Password)

**Performance Goals**: Same <300ms perceived-latency NFR; no new performance-sensitive path introduced

**Constraints**: Name, Username, and (for Students) Category MUST remain unwritable through every endpoint in this feature regardless of what a request body contains (FR-003/FR-005/FR-008); a Department update MUST be rejected unless it resolves under the caller's own `company_id` (research.md §3); a password change MUST verify the current password before applying any change and MUST revoke other sessions on success (FR-011/FR-012)

**Scale/Scope**: Same tenant/user scale as prior features; this is a low-frequency, low-complexity feature relative to `005`/`006` — no new concurrency or throughput considerations

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

As in prior features, `.specify/memory/constitution.md` remains an unfilled template; `docs/product/02-PRD.md` §FR-10 and `docs/ui-screen/06-UI-Design.md` §4.10–§4.12 govern this feature directly (generalized to all roles per the spec's explicit scope note). Checked against those:

- Username never editable from Profile or its API, display-only everywhere (PRD FR-10.2), generalized to Name per the resolved clarification (FR-008). ✅
- Edit action limited to Department and Email only (PRD FR-10.3), generalized: Email for all roles, Department for Students only. ✅
- Change Password requires current password + new + retype, distinct from OTP-based Forgot Password (PRD FR-10.4). ✅
- Successful password change revokes other active sessions (PRD FR-10.5, `002`'s mechanics). ✅
- No new Firebase/Supabase service or schema concept introduced. ✅

**Result**: PASS. No entries required in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/007-user-profile-management/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── openapi.yaml      # Phase 1 output (/speckit-plan command)
└── tasks.md               # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

Extends the `api/` structure from prior features. Adds a `profile/` module; touches no existing module's code, only `002`'s `auth_audit_logs` table (additively, via new event-type values — no migration needed for that either, since `event_type` is a `text` column, not an enum type).

```text
api/
├── src/
│   ├── profile/
│   │   ├── profile.controller.ts   # GET/PATCH /me/profile, POST /me/change-password
│   │   ├── profile.service.ts       # role-shaped view assembly, all-or-nothing edit, department-scope validation (research.md §3)
│   │   └── password-change.service.ts  # current-password verify, rehash, session-preservation logic (research.md §2)
│   └── common/
│       └── guards/
│           └── jwt-auth.guard.ts     # (reused from 002) — every route here just needs "authenticated," no role restriction
└── test/
    └── contract/
        └── profile/                  # role-shaped GET, all-or-nothing PATCH, cross-tenant department rejection, change-password session tests

mobile/
└── src/
    └── screens/
        └── profile/
            ├── Profile.tsx             # UI Design §4.10 — detail card, Edit button, Change Password link, Logout (reuses 002)
            ├── EditProfile.tsx          # UI Design §4.11 — Email + Department editable, Name/Username shown read-only for context
            └── ChangePassword.tsx        # UI Design §4.12 — Current/New/Retype, client-side match check before submit
```

**Structure Decision**: A single small `profile/` module — this feature's scope (view, one edit endpoint, one password-change endpoint, zero new tables) doesn't warrant splitting further, unlike `006`'s payments/orders split, which existed because those had genuinely different trust boundaries. Everything here operates under the same "any authenticated user, acting on their own account" boundary.

## Complexity Tracking

*No Constitution Check violations — this section is intentionally empty.*
