# Phase 1 Data Model: Contact Us Page

**Feature**: `015-contact-us-page` | **Date**: 2026-09-14

No new entity. This feature adds one nullable column to the existing `companies` table (owned by `001-company-role-user-setup`) and one new RLS policy on that same table. Both are documented in place in `specs/001-company-role-user-setup/data-model.md` (research.md §2) — summarized here for this feature's own traceability.

## 1. `companies` — delta only

| Column | Type | Constraints / Notes |
|---|---|---|
| `operating_hours` | `text` | nullable — free text (e.g. `"Mon–Sat, 9:00 AM – 8:00 PM"`); `NULL` renders as "not specified" to viewers (FR-005) |

No other column changes. `contact_person`, `mobile`, `email`, `address` are unchanged, already-required `001` columns, now additionally exposed read-only via this feature's new endpoint (§2 below).

## 2. RLS — delta only

New, additive policy on `companies` (alongside the existing `companies_system_admin_only`):

```sql
CREATE POLICY "companies_tenant_self_read" ON "companies"
  FOR SELECT
  USING (
    "company_id"... -- see note
  );
```

Note: `companies.id` *is* the company — the predicate compares the row's own `id` to the caller's session-scoped `app.current_company_id`, i.e. `USING (id = NULLIF(current_setting('app.current_company_id', true), '')::uuid)`. `FOR SELECT` only — grants no `INSERT`/`UPDATE`/`DELETE` to any non-system_admin role; those remain solely governed by `companies_system_admin_only`. See research.md §3 for why this is needed (it also fixes a dormant read gap in `007-user-profile-management`'s own company-name lookup).

## 3. Key Entity (spec cross-reference)

- **Company Contact Us Info**: Not a new entity — per `spec.md`'s Key Entities section, this is the existing `companies` row (`001`), read through a new narrower view (`contact_person`/`mobile`/`email`/`address`/`operating_hours` only) for the five tenant-side roles, and written through the existing `companies` write path (System Admin only, unchanged permission shape from `001`).
