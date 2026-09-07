# Tasks: Bootstrap Default System Admin Account

**Input**: Design documents from `/specs/012-bootstrap-system-admin-seed/` (spec.md, plan.md, research.md, data-model.md, quickstart.md — **no `contracts/`**: this feature exposes no HTTP interface, a deployment-time script only, per `011`'s precedent)

**Tests**: Included — `plan.md`'s Testing section commits to an idempotent-rerun test, a missing-env-var test, and a real end-to-end login test using the seeded credentials against `002`'s actual login endpoint.

**Organization**: Tasks are grouped by user story (spec.md priorities P1/P2), then Polish. **There is no Mobile phase** — this feature is a deployment-time seed script with zero client-facing surface. No spec ambiguity was found during task planning; this spec is unusually careful about its own scope, explicitly documenting two deliberate deviations from the original request's literal example values (no fixed cross-environment identity, no literal password ever committed) as security-motivated decisions, not omissions.

## Dependencies (read first)

- **`001-company-role-user-setup`**: this feature seeds into `001`'s existing `roles`/`users` tables — no schema change of its own.
- **`002-registration-login-jwt-auth`**: this feature reuses `002`'s `PasswordService` (Argon2id hashing) directly rather than re-implementing hashing in SQL — **`PasswordService` does not exist in the codebase yet** (`002`'s own tasks.md T004 defines it; nothing under `api/src/auth/` currently implements it). This feature's seed script cannot be completed until `002`'s Foundational phase lands.
- **A related gap in `001` itself, discovered during this feature's own planning** (not a new issue — already documented in research.md §1): `001`'s migration creates the *constraints* supporting a global `system_admin` role row (the partial unique index, the `roles_company_id_or_system_admin` CHECK) but never actually inserts that row — the Company-scoped role-seeding trigger only fires on Company creation, which never happens for the platform-wide role. This feature's seed script must create that role row first, before it can reference it.

## Phase 1: Setup

- [ ] None — no new dependency; reuses `002`'s existing `argon2`-based `PasswordService`.

---

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T001 Add `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_USERNAME`, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` as **script-only** environment variables (documented in `api/.env.example` with a clear comment that they are read only by `scripts/seed-system-admin.ts`, never by the running application — following the same `DATABASE_URL`-vs-`APP_DATABASE_URL` separation-of-concerns convention `env.validation.ts` already documents) — do **not** add these to `env.validation.ts`'s app-wide schema, since the running API itself never reads them (research.md §4)

**Checkpoint**: Configuration surface defined — the seed script itself can now be written.

---

## Phase 3: User Story 1 - A Freshly Deployed Environment Has a Working System Admin Account (Priority: P1) 🎯 MVP

**Goal**: Running the seed script against a fresh database creates exactly one global `system_admin` role row and exactly one System Admin user row referencing it, hashed via `002`'s real `PasswordService`; re-running it is a safe no-op.

**Independent Test**: Run the script twice against a disposable test database; confirm exactly one account exists after both runs, and that it can log in via `002`'s real `/auth/login` endpoint.

- [x] T002 [US1] Implement `api/scripts/seed-system-admin.ts`: read `BOOTSTRAP_ADMIN_NAME`/`_USERNAME`/`_EMAIL`/`_PASSWORD` from the environment, connect using the elevated/superuser `DATABASE_URL` credential (never `APP_DATABASE_URL` — no RLS-scoped session context exists yet for a pre-first-user seed, research.md §6), then: (a) `INSERT ... WHERE NOT EXISTS` a `roles` row with `name` resolving to the System Admin role and `company_id: NULL`, only if one doesn't already exist (research.md §1-§2); (b) `INSERT ... WHERE NOT EXISTS` the bootstrap `users` row — checked by "does any row already have a `role_id` resolving to `system_admin`", not by username — with `company_id`/`category_id`/`department_id`/`created_by`/`updated_by` all `NULL`, `status: 'active'`, `no_of_login_attempt: 0`, and `password_hash` computed via `002`'s `PasswordService.hash(...)` on the environment-supplied raw password (data-model.md, FR-001 thru FR-008)
- [x] T003 [US1] Ensure the script exits `0` and logs a clear, non-sensitive success/no-op message in both the "created" and "already existed" cases — **never** logging the raw configured password at any point, in any branch (FR-004, research.md §4)
- [ ] T004 [P] [US1] Integration tests in `test/seed/seed-system-admin/idempotent-rerun.spec.ts` (against a disposable test database): running the script once creates exactly one `roles` row (System Admin, `company_id IS NULL`) and exactly one referencing `users` row with the expected field values (data-model.md's Seed Step 1-2 tables); running it a second time exits `0` with no error and the count remains exactly one of each (FR-001, FR-002, SC-001, SC-002, quickstart Scenarios 1-2)
- [ ] T005 [P] [US1] End-to-end test in `test/seed/seed-system-admin/login-with-seeded-credentials.spec.ts`: after seeding, `POST /auth/login` (per `002`'s real endpoint, once it exists) with the configured username/password succeeds with a working session — the true proof this account is usable, not just present in the database (SC-004, quickstart Scenario 1 step 3)

**Checkpoint**: A fresh environment is usable immediately after deployment — the entire point of this feature.

---

## Phase 4: User Story 2 - The Bootstrap Credential Can Be Rotated Immediately (Priority: P2)

**Goal**: The seeded account's password can be changed via `007`'s existing change-password action with no special-casing.

**Independent Test**: Log into the seeded account and change its password via `007`'s real endpoint; confirm the new password then works for login.

- [ ] T006 [P] [US2] Integration test in `test/seed/seed-system-admin/password-rotation.spec.ts` (depends on `007` existing): log in with the seeded credentials, call `POST /me/change-password` (per `007`) with the correct current password and a new one, confirm `200`; log in again with the new password and confirm success — no special-casing needed anywhere in `007`'s code for this being the bootstrap account (FR-009, quickstart Scenario 4)

**Checkpoint**: The seeded credential's exposure window can be closed immediately using capability the platform already has.

---

## Phase 5: Missing-Configuration Failure Path (Edge Case, cross-cutting)

- [ ] T007 [P] Test in `test/seed/seed-system-admin/missing-env-var.spec.ts`: running the script with any one of the four required environment variables unset exits non-zero with a clear error identifying which value is missing, and inserts zero rows into `roles` or `users` as a result of that run (confirmed via a before/after row-count comparison) — never falls back to a blank, predictable, or hardcoded value (FR-005, research.md §4, quickstart Scenario 3)

---

## Phase 6: Polish

- [ ] T008 Run every scenario in `specs/012-bootstrap-system-admin-seed/quickstart.md` end-to-end against a disposable test database; fix any drift found
- [ ] T009 [P] Document `scripts/seed-system-admin.ts` and its four required environment variables in whatever deployment runbook/README covers first-time environment setup, so it's clear this script must run once per new environment (not per deploy) and where its required values come from

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)**: trivial, blocks nothing of substance but documents the config surface first.
- **US1 (Phase 3)**: needs `002`'s `PasswordService` to exist (see "Dependencies" above) — this is the actual blocker, not Phase 1/2. Independently testable once that exists — the MVP entry point (the whole reason this feature exists).
- **US2 (Phase 4)**: needs US1 (a seeded account to rotate) + `007`'s change-password endpoint to exist.
- **Edge Case (Phase 5)**: needs only T002 (the script itself); independent of US1's happy-path tests.
- **Polish (Phase 6)**: after all desired stories are done.

### Parallel Opportunities

- T004, T005, T007 all run in parallel once T002/T003 exist.
- Phase 6: T008 and T009 in parallel.

## Implementation Strategy

**MVP first**: Phase 1 → Phase 2 → Phase 3 (US1) is the entire point of this feature — a fresh environment usable with zero manual database steps. This is blocked externally on `002`'s `PasswordService` existing, not on anything internal to this feature.

**Incremental delivery**: Phase 5 (the missing-config failure path) can be built alongside Phase 3 since it only needs the script itself, then Phase 4 (US2, password rotation — needs `007`), then Phase 6 (polish, including runbook documentation so this one-time step isn't forgotten during actual deployment).
