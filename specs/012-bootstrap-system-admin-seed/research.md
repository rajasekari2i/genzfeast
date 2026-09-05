# Phase 0 Research: Bootstrap Default System Admin Account

**Feature**: `012-bootstrap-system-admin-seed` | **Date**: 2026-09-05

Depends on `001-company-role-user-setup` (`users`/`roles`) and `002-registration-login-jwt-auth` (password hashing). This document resolves the implementation-pattern unknowns for safely, idempotently seeding the platform's first account.

## 1. A related gap `001` also left open: the global `system_admin` role row itself

- **Finding**: `001`'s data model defines a `roles` table with a partial unique index guaranteeing *at most one* global `system_admin` row (`company_id IS NULL`), and its trigger seeds the three Company-scoped roles whenever a Company is created — but nothing anywhere seeds the global `system_admin` role row itself. A bootstrap user can't reference a role that doesn't exist yet.
- **Decision**: This feature's seed process first ensures the global `system_admin` role row exists (`INSERT ... WHERE NOT EXISTS`, matching the same idempotent pattern used for the user itself, research.md §2), before creating the bootstrap user that references it.
- **Rationale**: Without this, the feature's own FR-001 is unsatisfiable on a truly fresh database — there would be no `system_admin` role id to assign. This is a small, necessary extension of scope discovered during planning, not a re-litigation of `001`'s design.
- **Alternatives considered**: Requiring `001`'s own migration to have seeded this role — rejected as a retroactive change to an already-planned feature; picking it up here (where it's actually needed to make progress) is simpler than reopening `001`.

## 2. Idempotent seeding mechanism

- **Decision**: The seed step for both the role row and the user row uses `INSERT ... SELECT ... WHERE NOT EXISTS (...)` — never a blind `INSERT`, and never a `DELETE`-then-`INSERT` pattern. For the user specifically, the "already exists" check is "does any row in `users` have a `role_id` resolving to `system_admin`" — not a check on a specific username, since a future environment might have a differently-named bootstrap account.
- **Rationale**: Directly implements FR-002 (safely re-runnable, no duplicates, no destructive error) using a standard, well-understood SQL idempotency pattern rather than a stateful "have I run before" flag that could itself get out of sync with reality.
- **Alternatives considered**: A migration-tracking flag/table recording "bootstrap already ran" — rejected as an extra piece of state that could diverge from the actual row's presence (e.g., if the user row were ever manually removed, the flag would incorrectly prevent re-seeding).

## 3. Password hashing requires a small script, not pure SQL

- **Decision**: The seed step is implemented as a small Node.js script (reusing `002`'s existing `PasswordService`/Argon2id hashing, not a new hashing implementation) run as part of the deployment process, rather than a pure `.sql` migration file. It reads the required identity/password values from environment variables, hashes the password using the same code path `002` already uses for every other account, and performs the idempotent inserts from research.md §1-§2.
- **Rationale**: Argon2id hashing isn't something a plain SQL migration can perform using the same library/parameters `002` already established for every other password in the system; reusing the actual application code path (rather than re-implementing hashing in SQL via `pgcrypto` or similar) guarantees the seeded account's hash is verifiable by the exact same login code every other account already uses, with zero risk of a parameter mismatch (e.g., a different Argon2 cost setting) between the seed and the app.
- **Alternatives considered**: Hashing directly in SQL via `pgcrypto`'s `crypt()`/bcrypt functions — rejected because `002` already chose Argon2id specifically (research.md §1 there), and introducing a second hashing implementation just for this one row would risk producing a hash the application's own verify code doesn't handle identically.

## 4. Required environment variables, and failing loudly when they're missing

- **Decision**: Four required environment variables: the bootstrap account's name, username, email, and initial password (raw, used only transiently to compute its hash — never logged, never persisted, never written back to any file). If any is missing when the seed script runs, it exits with a clear, non-zero-status error and creates nothing — it never falls back to a blank, predictable, or hardcoded value.
- **Rationale**: Directly implements FR-005 (per-environment configuration, not one shared identity) and the Edge Case's explicit requirement to fail clearly rather than silently seed something insecure.
- **Alternatives considered**: A checked-in default (e.g., a fixed dev-only fallback password) used when the environment variable is absent — rejected; even a clearly-labeled "dev-only" fallback risks being accidentally left unset in a real environment and silently applied, which is exactly the failure mode FR-005/the Edge Case exist to prevent.

## 5. `company_id`, `category_id`, `department_id`, and `created_by`/`updated_by` are all `NULL`

- **Decision**: The seeded row sets `company_id`, `category_id`, and `department_id` to `NULL` (per FR-003/FR-008 and `001`'s existing schema, where all three are nullable and only meaningful for Company-scoped roles), and `created_by`/`updated_by` to `NULL` as well, since — like the very first Company row `001` already anticipated — there is no other user yet to credit as the creator.
- **Rationale**: This is the simplest option consistent with `001`'s already-nullable column design; no new schema accommodation is needed.
- **Alternatives considered**: Self-referencing `created_by`/`updated_by` to the new row's own `id` — rejected as unnecessary complexity for a column that's already nullable specifically to handle this exact "no prior creator exists" case (`001`'s own data-model.md called this out for `companies.created_by`; the same reasoning applies here).

## 6. Runs with elevated privileges, bypassing RLS by design

- **Decision**: The seed script connects using a service-role/elevated database credential (the same class of connection Supabase migrations already use), not the application's normal per-request, RLS-scoped connection. This is expected and required — no student/staff/company-admin/system-admin session context exists yet for the script to assume.
- **Rationale**: RLS policies (`001`'s `tenant_isolation_*` policies, and every subsequent feature's policies) are predicated on session variables (`app.current_user_id`, etc.) that only exist within an authenticated API request; a deployment-time seed script has no such request to be part of, so it necessarily runs outside that model, exactly like every other schema migration already does.
- **Alternatives considered**: Routing the seed through the application's own API (e.g., calling a "create system admin" endpoint) — rejected; no such endpoint exists or should exist (per the spec's own Assumption that ongoing System Admin creation is out of scope), and a fresh environment has no valid JWT to authenticate such a call with anyway.

## Outstanding NEEDS CLARIFICATION

None. The spec shipped with zero clarification markers.
