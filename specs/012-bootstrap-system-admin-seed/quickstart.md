# Quickstart: Validating the Bootstrap System Admin Seed

**Feature**: `012-bootstrap-system-admin-seed`

This feature has no HTTP endpoints — it's a deployment-time seed script. Validation happens by running it against a database and then exercising `002`'s existing login endpoint with the resulting account.

## Prerequisites

- A fresh (or test) Supabase Postgres database with `001`'s `roles`/`users` migrations applied, and nothing else seeded.
- The four required environment variables set: bootstrap name, username, email, and initial password.
- The seed script and `002`'s existing login endpoint both available to run against this database.

## Scenario 1 — Fresh environment (User Story 1)

1. Run the seed script against a database with zero existing users.
   - **Expect**: exit code `0`; exactly one `roles` row with `name` resolving to System Admin and `company_id IS NULL`; exactly one `users` row referencing it.
2. Inspect the seeded `users` row directly.
   - **Expect**: `company_id IS NULL`, `category_id IS NULL`, `department_id IS NULL`, `status = 'active'`, `no_of_login_attempt = 0`, `password_hash` is a non-empty Argon2id hash (never the raw configured password).
3. `POST /auth/login` (per `002`) with the configured username/password.
   - **Expect**: `200`, a working session — confirms SC-004 end-to-end.

## Scenario 2 — Idempotent re-run (User Story 1, Scenario 3)

1. Run the seed script again against the same database (already seeded by Scenario 1).
   - **Expect**: exit code `0`, no error.
2. Count `users` rows whose `role_id` resolves to System Admin.
   - **Expect**: still exactly `1` — no duplicate created (SC-002).

## Scenario 3 — Missing configuration fails loudly (Edge Case)

1. Run the seed script with one of the four required environment variables unset (e.g., no password provided).
   - **Expect**: non-zero exit code, a clear error identifying the missing value; zero rows inserted into `roles` or `users` as a result of this run (confirm via a follow-up count matching whatever existed before the run).

## Scenario 4 — Password rotation works normally (User Story 2)

1. Using the account from Scenario 1, log in and call `007`'s `POST /me/change-password` with the correct current password and a new one.
   - **Expect**: `200` — succeeds exactly as it would for any other account, no special-casing required.
2. Log in again with the new password.
   - **Expect**: `200`.

## Pass/Fail

Any deviation — especially a re-run creating a second System Admin account (Scenario 2), a missing-configuration run silently succeeding with a predictable fallback (Scenario 3), or the seeded account's raw password appearing anywhere in logs/output — is a blocking failure per SC-002/SC-003 and must not ship.
