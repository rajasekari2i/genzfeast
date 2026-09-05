# Phase 1 Data Model: Company Admin Product Management

**Feature**: `004-company-admin-product-crud` | **Date**: 2026-09-05

Adds one new table, `products`, on top of the `companies`/`users` schema from `001-company-role-user-setup`. No changes to any existing table.

## Entity Relationship Overview

```
companies (1) ──< products (many)
users     (1) ──< products (many, via created_by/updated_by)
```

`orders` (a future, not-yet-specified feature) will reference `products.id` as a foreign key for historical line items; this feature guarantees that reference stays valid by never hard-deleting a row (research.md §4).

## 1. `products`

| Column | Type | Constraints / Notes |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `company_id` | `uuid` | not null, references `companies(id)` |
| `name` | `text` | not null |
| `description` | `text` | not null |
| `image_url` | `text` | nullable — set only once a photo has been uploaded to Supabase Storage (research.md §1); `NULL` is a valid, expected state (Assumption: photo is optional) |
| `price` | `integer` | not null, `CHECK (price > 0)` — whole-number amount in the smallest currency unit (e.g. paise), per FR-004/FR-010 and the platform's general money convention |
| `is_veg` | `boolean` | not null — no default; the Company Admin must explicitly choose at creation (spec: required field) |
| `is_soldout` | `boolean` | not null, default `false` (FR-005) |
| `is_deleted` | `boolean` | not null, default `false` (FR-008, research.md §4) |
| `created_by`, `updated_by` | `uuid` | references `users(id)` |
| `created_at`, `updated_at` | `timestamptz` | not null, default `now()` |

**Constraints**:
- No uniqueness constraint on `(company_id, name)` — deliberate; see research.md §5.
- `CHECK (price > 0)` directly enforces FR-004/FR-010 at the database layer, not just in application validation.

## Row Level Security

```sql
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_select ON products
  FOR SELECT USING (company_id = current_setting('app.current_company_id', true)::uuid);

CREATE POLICY tenant_isolation_write ON products
  FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK (company_id = current_setting('app.current_company_id', true)::uuid);
```

Deliberately no `system_admin` bypass predicate here (research.md §2) — this matches the corrected FR-003, which does not grant System Admin cross-tenant Product access. Within a tenant, the API layer additionally distinguishes:
- Company Admin: full CRUD (create, update all fields, toggle, soft-delete).
- Staff: `PATCH .../soldout` only (FR-012) — enforced at the API/authorization layer (role check), not by a separate RLS policy, since RLS here only needs to answer "which company," not "which role within the company."

## Validation Rules Summary (from spec Functional Requirements)

| Rule | Source |
|---|---|
| Name and Price required; Price must be > 0 | FR-004 |
| New product defaults to not sold out | FR-005 |
| Sold-out toggle does not require/affect other fields | FR-006 |
| Edit updates only submitted fields, leaves others untouched | FR-007 |
| Removal is soft-delete; excluded from active list; existing references stay valid | FR-008, FR-009 |
| A removed product cannot be edited/toggled/removed again via the normal flow | FR-009 |
| Cross-company access denied regardless of role | FR-003 (corrected) |
| Sold-out toggle also available to Staff, not just Company Admin | FR-012 |

## State Transitions

**Sold-out status** (independent of soft-delete):
```
available <──toggle──> sold_out
```

**Lifecycle** (soft-delete is one-way through the normal management flow):
```
active (is_deleted=false) --(Company Admin removes)--> removed (is_deleted=true)
removed --(no path back via this feature's endpoints)--> stays removed
```
