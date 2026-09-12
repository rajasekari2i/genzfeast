# Phase 1 Data Model: Company, Role, Category, Department & User Creation

**Feature**: `001-company-role-user-setup` | **Date**: 2026-09-05

Target: Supabase-managed PostgreSQL (Architecture §2). Common auditability columns (`created_by`, `updated_by`, `created_at`, `updated_at`) and `is_deleted` soft-delete follow the platform-wide NFR (PRD §4) and are included on every table below except where noted.

## Entity Relationship Overview

```
companies (1) ──< roles (many, company-scoped; one global system_admin row has company_id = NULL)
companies (1) ──< categories (many)
companies (1) ──< departments (many)
companies (1) ──< users (many)
roles       (1) ──< users (many)         -- every user has exactly one role
categories  (1) ──< users (many, nullable for non-Student roles)
departments (1) ──< users (many, nullable)
```

`products`, `orders`, `deliveries`, and `refresh_tokens` are out of scope for this feature (owned by later modules) but are referenced here only insofar as `categories`/`departments`/`users` must remain valid foreign-key targets for them.

## 1. `companies` (Tenant)

| Column | Type | Constraints / Notes |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `name` | `text` | not null |
| `contact_person` | `text` | not null |
| `mobile` | `text` | not null |
| `email` | `text` | not null |
| `address` | `text` | not null |
| `is_open` | `boolean` | not null, default `true` — governs new order acceptance only (spec Assumptions); does not gate login/registration |
| `is_sms` | `boolean` | not null, default `true` (FR-002a) — governs specs/014's registration mobile-verification delivery channel: `true` = MSG91 SMS (FCM push only as a failure-fallback, unchanged); `false` = FCM push directly, MSG91 never attempted |
| `is_deleted` | `boolean` | not null, default `false` |
| `created_by`, `updated_by` | `uuid` | references `users(id)`, nullable (the very first company has no creating user row yet — System Admin identity is carried in the JWT, not necessarily a `users` row in this schema; see Open Follow-Up below) |
| `created_at`, `updated_at` | `timestamptz` | not null, default `now()` |

**Trigger**: `AFTER INSERT ON companies` → seeds three rows into `roles` (`company_admin`, `staff`, `student`) with `company_id = NEW.id` (research.md §3).

## 2. `roles`

| Column | Type | Constraints / Notes |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `name` | `text` | not null — one of `SYSTEM_ADMIN`, `COMPANY_ADMIN`, `STAFF`, `STUDENT`, `TEACHING`, `NON_TEACHING` |
| `company_id` | `uuid` | references `companies(id)`, **nullable** — `NULL` only for the single global `system_admin` role |
| `created_at`, `updated_at` | `timestamptz` | not null, default `now()` |

**Constraints**:
- `UNIQUE (company_id, name)` — a company cannot have two roles with the same name; the global `system_admin` row is unique via a partial unique index `UNIQUE (name) WHERE company_id IS NULL`.
- `CHECK (company_id IS NOT NULL OR name = 'system_admin')` — only `system_admin` may have a null `company_id`.

## 3. `categories`

| Column | Type | Constraints / Notes |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `company_id` | `uuid` | not null, references `companies(id)` |
| `name` | `text` | not null — a registrant-affiliation label, e.g. "Student", "Teaching Staff", "Non-Teaching Staff" (spec FR-020; independent of any future product-classification concept) |
| `is_deleted` | `boolean` | not null, default `false` |
| `created_by`, `updated_by` | `uuid` | references `users(id)` |
| `created_at`, `updated_at` | `timestamptz` | not null, default `now()` |

**Constraints**: partial unique index `UNIQUE (company_id, lower(name)) WHERE is_deleted = false` (research.md §4).

## 4. `departments`

| Column | Type | Constraints / Notes |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `company_id` | `uuid` | not null, references `companies(id)` |
| `name` | `text` | not null — e.g. "Computer Science" |
| `is_deleted` | `boolean` | not null, default `false` |
| `created_by`, `updated_by` | `uuid` | references `users(id)` |
| `created_at`, `updated_at` | `timestamptz` | not null, default `now()` |

**Constraints**: partial unique index `UNIQUE (company_id, lower(name)) WHERE is_deleted = false`.

## 5. `users`

| Column | Type | Constraints / Notes |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `company_id` | `uuid` | references `companies(id)`, **nullable** — `NULL` only for a `system_admin` user |
| `role_id` | `uuid` | not null, references `roles(id)` |
| `category_id` | `uuid` | references `categories(id)`, nullable — required at the API layer when `role = student` (FR-011), not applicable to other roles |
| `department_id` | `uuid` | references `departments(id)`, nullable — optional even for Students (spec Assumptions) |
| `name` | `text` | not null |
| `username` | `text` | not null — mobile number |
| `password_hash` | `text` | not null — bcrypt/argon2 (PRD §4 NFR); never the raw `password` |
| `email` | `text` | not null |
| `status` | `text` | not null, default `'active'` — `active` \| `inactive` \| `locked` |
| `no_of_login_attempt` | `integer` | not null, default `0` (owned by the auth feature; column reserved here since it lives on the same table) |
| `is_deleted` | `boolean` | not null, default `false` |
| `created_by`, `updated_by` | `uuid` | references `users(id)`, nullable (self-registration has no creator; System Admin/Company Admin-created accounts reference the creator) |
| `created_at`, `updated_at` | `timestamptz` | not null, default `now()` |

**Constraints**:
- Partial unique index `UNIQUE (company_id, lower(username)) WHERE is_deleted = false` (research.md §5) — for the `system_admin` row(s), `company_id IS NULL`, so uniqueness there is `UNIQUE (lower(username)) WHERE is_deleted = false AND company_id IS NULL`.
- `CHECK`: a row whose `role_id` resolves to `student` MUST have `category_id IS NOT NULL` — enforced at the application layer (Nest DTO validation) since a cross-table check constraint against `roles.name` is not directly expressible as a simple `CHECK`; documented here as a required validation rule (FR-011, FR-015).
- A row whose `role_id` resolves to `system_admin` MUST have `company_id IS NULL`; every other role MUST have `company_id` matching the role's own `company_id` — enforced at the application layer and additionally covered by RLS `WITH CHECK` (research.md §2), so a mismatched pairing can never be persisted through the API even if a validation bug slips through.

## Row Level Security Summary

Applied to `categories`, `departments`, `users` (and `companies` for read scoping — System Admin sees all rows, every other role sees none directly since Company management is System-Admin-only per FR-001/002):

```sql
-- Example: categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_select ON categories
  FOR SELECT USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.current_role', true) = 'system_admin'
  );

CREATE POLICY tenant_isolation_write ON categories
  FOR ALL USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.current_role', true) = 'system_admin'
  )
  WITH CHECK (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.current_role', true) = 'system_admin'
  );
```

The same shape applies to `departments` and `users`. `roles` is readable platform-wide by `system_admin` and readable (not writable) by any authenticated user scoped to their own `company_id`, since a Company Admin needs to see the fixed role list to assign roles when creating Staff/peer-admin accounts (FR-009/FR-019) but never to invent new ones (spec Assumption: fixed role set in V1).

## Validation Rules Summary (from spec Functional Requirements)

| Rule | Source |
|---|---|
| Company requires name, contact_person, mobile, email, address | FR-001 |
| A new Company auto-seeds `company_admin`/`staff`/`student` roles | FR-003 |
| Category/Department name unique per company (case-insensitive), among non-deleted rows | FR-006, FR-007, research.md §4 |
| Category/Department cannot be hard-deleted while referenced; soft-delete only | FR-008 |
| Staff/Company Admin creation requires name, username, temporary password, email | FR-009 |
| Student registration requires name, username, password, email, category; department optional | FR-011 |
| Username unique per company (case-insensitive), among non-deleted rows | FR-013, research.md §5 |
| Every User has exactly one Role at creation | FR-015 |
| Company Admin cannot assign Student or System Admin role when creating a user | FR-018, FR-019 |
| Category represents registrant affiliation type, not a product classification | FR-020 |

## Open Follow-Up (not blocking this feature)

- `created_by`/`updated_by` on the very first `companies` row and the very first `users` row (the platform's own bootstrap System Admin) have no natural creator `users.id` to point to. This plan treats those columns as nullable and defers the System Admin's own account provisioning (whether it is a `users` row at all, or an out-of-band credential) to the authentication feature, consistent with `refresh_tokens`/login being out of this feature's scope.
