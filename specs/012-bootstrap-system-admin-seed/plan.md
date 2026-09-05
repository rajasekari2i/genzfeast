# Implementation Plan: Bootstrap Default System Admin Account

**Branch**: `012-bootstrap-system-admin-seed` | **Date**: 2026-09-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-bootstrap-system-admin-seed/spec.md`

## Summary

Close the platform's chicken-and-egg bootstrap gap (`001`'s own flagged "Open Follow-Up") with a small, idempotent seed script — not a schema migration — that ensures the global `system_admin` role row exists (a related gap `001` also left open, discovered during this planning) and then ensures exactly one System Admin `users` row exists, referencing it. The script reuses `002`'s existing Argon2id password-hashing code path rather than re-implementing hashing in SQL, sources its identity/password from required environment variables (never a hardcoded or checked-in value), and fails loudly if any are missing rather than falling back to something predictable. Running it any number of times against the same database never produces more than one bootstrap account.

## Technical Context

**Language/Version**: TypeScript (Node.js 20 LTS) for the seed script, reusing `002`'s `PasswordService` directly — not a `.sql`-only migration, since Argon2id hashing needs the same code path every other password in the system already goes through (research.md §3)

**Primary Dependencies**: `002`'s existing `argon2`-based `PasswordService`; no new dependency

**Storage**: Supabase-managed PostgreSQL — no schema changes; two idempotent `INSERT ... WHERE NOT EXISTS` operations against `001`'s existing `roles` and `users` tables (data-model.md)

**Testing**: An integration test running the seed script twice against a disposable test database and asserting exactly one System Admin account exists after both runs (`quickstart.md` Scenarios 1-2); a test asserting a missing required environment variable aborts the script with zero rows written (Scenario 3); a test logging in with the seeded credentials via `002`'s real login endpoint (Scenario 1 step 3) as the true end-to-end proof

**Target Platform**: Runs once per environment as part of the deployment process (alongside, but not as, a schema migration), against the same Supabase Postgres instance every other feature targets

**Performance Goals**: Not applicable — a one-time, low-frequency deployment-time operation, not a request-path concern

**Constraints**: MUST use `INSERT ... WHERE NOT EXISTS` idempotency, never a destructive delete-then-recreate pattern (research.md §2); MUST fail with a non-zero exit and create nothing if any of the four required environment variables is absent (research.md §4); MUST NEVER write the raw configured password to any log, file, or committed source (FR-004); MUST run under an elevated/service-role database connection, not the application's normal RLS-scoped connection, since no authenticated session context exists yet for this to run within (research.md §6)

**Scale/Scope**: Exactly one row-pair (role + user) per environment, ever — no scale consideration applies

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

As in prior features, `.specify/memory/constitution.md` remains an unfilled template; `001-company-role-user-setup`'s own data-model.md "Open Follow-Up" note and `002-registration-login-jwt-auth`'s established password-hashing standard govern this feature directly. Checked against those:

- Bootstrap account has no `company_id`, consistent with the System Admin role's existing platform-wide definition (`001`). ✅
- Password hashed via the exact same Argon2id code path every other account already uses — no second hashing implementation introduced (`002`'s established standard). ✅
- No plaintext credential committed to source control (platform-wide security posture, reinforced explicitly in this spec's own Assumptions). ✅
- No new RLS bypass introduced for any application role — the seed script's elevated access is a deployment-time operation outside the request-scoped RLS model entirely, the same category every other schema migration already falls into, not a new exception carved into the running application's authorization rules. ✅

**Result**: PASS. No entries required in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/012-bootstrap-system-admin-seed/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
└── quickstart.md         # Phase 1 output (/speckit-plan command)
```

No `contracts/` directory — this feature exposes no HTTP interface (a deployment-time script only), consistent with `011`'s precedent for purely internal capabilities.

### Source Code (repository root)

No new application module. Adds one deployment script that reuses existing `002` code.

```text
api/
├── scripts/
│   └── seed-system-admin.ts    # reads required env vars, idempotently seeds the system_admin role row and the bootstrap user row via PasswordService (002)
└── src/
    └── auth/
        └── password.service.ts  # (002, reused — not modified) — the seed script imports this rather than re-implementing hashing

test/
└── seed/
    └── seed-system-admin/         # idempotent-rerun test, missing-env-var test, real-login-with-seeded-credentials test (quickstart.md)
```

**Structure Decision**: A single deployment script under `api/scripts/`, not an application module — this has no request-path behavior and nothing to expose via the API, matching `011`'s precedent that infrastructure-only capabilities don't need a `src/` module of their own.

## Complexity Tracking

*No Constitution Check violations — this section is intentionally empty.*
