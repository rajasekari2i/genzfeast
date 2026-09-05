# Phase 1 Data Model: Bootstrap Default System Admin Account

**Feature**: `012-bootstrap-system-admin-seed` | **Date**: 2026-09-05

No new tables and no schema changes — this feature is a one-time idempotent data seed against `001-company-role-user-setup`'s existing `roles` and `users` tables, executed via a small script (research.md §3), not a schema migration.

## Seed Step 1 — the global `system_admin` role (research.md §1)

Idempotent condition: does a `roles` row already exist with `name = 'system_admin'` and `company_id IS NULL`?

| Column | Seeded value |
|---|---|
| `id` | generated (`gen_random_uuid()`) |
| `name` | the System Admin role's name (case/exact value per `001`'s implementation — this feature does not redefine it) |
| `company_id` | `NULL` |

## Seed Step 2 — the bootstrap `users` row

Idempotent condition: does a `users` row already exist whose `role_id` resolves to the global `system_admin` role (from Step 1)?

| Column | Seeded value |
|---|---|
| `id` | generated (`gen_random_uuid()`) |
| `company_id` | `NULL` (FR-003) |
| `role_id` | the global `system_admin` role's `id`, from Step 1 |
| `category_id` | `NULL` (FR-008, research.md §5) |
| `department_id` | `NULL` (FR-008, research.md §5) |
| `name` | from environment configuration (research.md §4) |
| `username` | from environment configuration |
| `password_hash` | Argon2id hash of the environment-supplied raw password, computed via `002`'s existing `PasswordService` (research.md §3) — the raw value is never persisted or logged |
| `email` | from environment configuration |
| `status` | `'active'` (FR-006) |
| `no_of_login_attempt` | `0` (FR-006) |
| `is_deleted` | `false` |
| `created_by`, `updated_by` | `NULL` (research.md §5 — no prior user exists to credit) |
| `created_at`, `updated_at` | `now()` at seed time |

## Validation Rules Summary (from spec Functional Requirements)

| Rule | Source |
|---|---|
| Exactly one System Admin account created if none exists | FR-001 |
| Re-running the seed never duplicates or errors destructively | FR-002 (research.md §2) |
| Seeded account has no `company_id` | FR-003 |
| Password stored only as a secure hash, never committed in plaintext | FR-004 (research.md §3) |
| Identity + initial password come from per-environment configuration | FR-005 (research.md §4) |
| Seeded account starts `active`, zero failed attempts | FR-006 |
| Exactly one role: the platform-wide System Admin role | FR-007 |
| No Category or Department assigned | FR-008 (research.md §5) |
| Password changeable via the existing change-password capability | FR-009 — trivially true: the seeded row is an ordinary `users` row with a normal `password_hash`; `007`'s change-password flow requires no special-casing for it |

## State Transitions

None — this is a one-time data seed, not an entity with its own lifecycle. The resulting `users`/`roles` rows are thereafter ordinary rows governed entirely by `001`'s (and every dependent feature's) existing rules — nothing about "being the bootstrap account" is tracked as a distinguishing flag or state.
