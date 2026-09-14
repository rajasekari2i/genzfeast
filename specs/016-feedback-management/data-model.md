# Phase 1 Data Model: Feedback Management

**Feature**: `016-feedback-management` | **Date**: 2026-09-14

Adds one new table, `feedback`, on top of the `companies`/`users` schema from `001-company-role-user-setup`. No changes to any existing table other than a doc-comment correction on the `AuditLog` Prisma model (research.md §2).

## Entity Relationship Overview

```
companies (1) ──< feedback (many)
users     (1) ──< feedback (many, via user_id — the submitter)
users     (1) ──< feedback (many, via created_by/updated_by — audit actor, research.md §4)
```

## 1. `feedback`

| Column | Type | Constraints / Notes |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `company_id` | `uuid` | not null, references `companies(id)` — always the submitter's own tenant from the verified JWT (FR-006), never client-supplied |
| `user_id` | `uuid` | not null, references `users(id)` — the submitter (research.md §4); immutable after creation |
| `rating` | `smallint` | nullable — `CHECK (rating IS NULL OR rating BETWEEN 1 AND 5)` (FR-002) |
| `category` | `text` | not null — `CHECK (category IN ('app_experience','food_order_quality','payment_issue','pickup_experience','suggestion','other'))` (FR-003, research.md §1) |
| `message` | `text` | not null — `CHECK (char_length(message) BETWEEN 1 AND 1000)` (FR-004, FR-007) |
| `contact_requested` | `boolean` | not null, default `false` (FR-005) |
| `status` | `text` | not null, default `'new'` — `CHECK (status IN ('new','resolved'))` (FR-009, FR-013) |
| `is_deleted` | `boolean` | not null, default `false` — platform-wide soft-delete convention; no endpoint in this feature sets it |
| `created_by` | `uuid` | nullable, references `users(id)` — audit actor (same value as `user_id` at creation; see research.md §4) |
| `updated_by` | `uuid` | nullable, references `users(id)` — audit actor; becomes the resolving Company Admin's id once resolved |
| `created_at` | `timestamptz` | not null, default `now()` |
| `updated_at` | `timestamptz` | not null, default `now()`, auto-updated on every write |

**Constraints**:
- `CHECK (rating IS NULL OR rating BETWEEN 1 AND 5)` directly enforces FR-002 at the database layer, not just in application validation.
- `CHECK (category IN (...))` directly enforces FR-003's fixed value set — see research.md §1 for why this is a `CHECK`, not a lookup table.
- `CHECK (char_length(message) BETWEEN 1 AND 1000)` enforces FR-004/FR-007 (required, non-empty, bounded) at the database layer; the same 1–1000 bound is additionally validated at the DTO layer (`class-validator`) so a violation surfaces as a `400` before ever reaching the database.
- `CHECK (status IN ('new','resolved'))` enforces FR-009's two-state model at the database layer.

**Indexes**:
- `(company_id, status)` — the Company Admin review queue's primary query shape (FR-010, FR-011): "this company's feedback, optionally filtered by status."
- `(company_id, created_at DESC)` — supports the "newest first" default ordering (User Story 2, Acceptance Scenario 1).

## Row Level Security

```sql
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY feedback_tenant_isolation ON feedback
  FOR ALL
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid)
  WITH CHECK (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);
```

A single `FOR ALL` policy, matching the pattern already established for `products` (`004`) and other single-predicate tenant-scoped tables in this schema — no behavioral difference from separate SELECT/write policies here, since both predicates are identical. Deliberately **no `system_admin` bypass predicate** (spec Assumptions: System Admin is excluded from this feature entirely; unlike Categories/Departments/Companies/Roles, no FR anywhere in `spec.md` grants System Admin cross-tenant feedback access) — matching `004`'s corrected Products precedent, per `coding_standard.md` §5.3's "no bypass unless a spec's FRs explicitly grant it."

Within a tenant, the API layer additionally distinguishes:
- Any authenticated role (Student, Teaching, Non-Teaching, Company Staff, Company Admin): may `POST /me/feedback` (create only).
- Company Admin only: may `GET`/`PATCH` `/tenant/feedback...` (list, view detail, resolve).

This role split is enforced via `@Roles(...)` guards at the API/authorization layer (`coding_standard.md` §3), not via a separate RLS policy — matching `004`'s own reasoning that RLS here only needs to answer "which company," not "which role within the company."

**Database grant** (`coding_standard.md` §4.2 workflow): `GRANT SELECT, INSERT, UPDATE ON feedback TO app_user;` — no `DELETE`, since this feature never hard-deletes a row.

**Audit trigger** (research.md §2):

```sql
CREATE TRIGGER audit_feedback
  AFTER INSERT OR UPDATE ON feedback
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
```

Reuses `011`'s existing, already-generic trigger function — no new function, no change to the `audit_logs` table itself.

## Validation Rules Summary (from spec Functional Requirements)

| Rule | Source |
|---|---|
| Rating, when provided, must be an integer 1–5; omitting it is valid | FR-002 |
| Category is required, one of the fixed six values | FR-003 |
| Message is required, non-empty | FR-004, FR-007 |
| `contact_requested` defaults to not requested; when true, the submitter's on-file email is surfaced to Company Admin at detail-view time only (research.md §3) | FR-005, FR-012 |
| A submission missing Category or Message is rejected with no record created | FR-007 |
| New records always start at `status = 'new'` | FR-009 |
| Only Company Admin may change `status`, and only `new → resolved` | FR-013, FR-014 |
| Feedback is visible/filterable/modifiable only within the submitter's own company, at both API and RLS layers | FR-015 |
| Standard audit columns (`created_by`/`updated_by`/timestamps) present on every row | FR-016 |
| Soft-delete only if ever removed; no hard delete | FR-017 |

## State Transitions

```
new ──(Company Admin resolves)──> resolved
resolved ──(resolve called again)──> resolved   (no-op success, research.md §5)
resolved ──(no path back via this feature's endpoints)──> stays resolved
```
