# Quickstart: Validating Company, Role, Category, Department & User Creation

**Feature**: `001-company-role-user-setup`

This is a manual/scriptable validation guide proving the feature works end-to-end, against the contract in `contracts/openapi.yaml` and the schema in `data-model.md`. It does not replace automated contract/RLS tests (research.md §6) — it's what you run once those exist to sanity-check a real environment.

## Prerequisites

- A running API instance (per Architecture §1) pointed at a Supabase Postgres database with the migrations from `data-model.md` applied (tables, triggers, RLS policies).
- A bootstrap System Admin credential (out of scope for this feature — see `data-model.md`'s Open Follow-Up) able to obtain a JWT with `role: system_admin`.
- An HTTP client (`curl`/Postman) or the contract-test suite.

## Scenario 1 — Onboard a new tenant (User Story 1)

1. As System Admin, `POST /admin/companies` with a valid body (name, contact_person, mobile, email, address).
   - **Expect**: `201`, response includes `id`, `is_open: true`.
   - **Verify**: querying `roles` for the new `company_id` returns exactly 3 rows (`company_admin`, `staff`, `student`) — confirms the seeding trigger (research.md §3).
2. As System Admin, `POST /admin/companies/{companyId}/admins` with name/username/password/email.
   - **Expect**: `201`, response `role: company_admin`, `company_id` matches the created company.
3. Log in as the new Company Admin (auth feature, out of scope) and confirm the resulting JWT carries the correct `company_id`/`role` claims.
4. As System Admin, `PATCH /admin/companies/{companyId}` with `{"is_open": false}`.
   - **Expect**: `200`, `is_open: false` reflected immediately on a subsequent `GET`.

## Scenario 2 — Company Admin sets up master data (User Story 2)

1. As the Company Admin from Scenario 1, `POST /tenant/categories` with `{"name": "Student"}`, then again with `{"name": "Teaching Staff"}`.
   - **Expect**: both `201`.
2. Repeat `POST /tenant/categories` with `{"name": "student"}` (case-variant duplicate).
   - **Expect**: `400`/`409` per the case-insensitive uniqueness rule (research.md §4).
3. `POST /tenant/departments` with `{"name": "Computer Science"}`.
   - **Expect**: `201`.
4. `GET /tenant/categories` as a Company Admin from a **different** company (created via a second run of Scenario 1).
   - **Expect**: the first company's categories never appear in this response — tenant isolation (FR-006/FR-016).

## Scenario 3 — Company Admin creates Staff & a peer Admin (User Story 3)

1. `POST /tenant/users` with `role: staff` and valid fields.
   - **Expect**: `201`, `role: staff`, `company_id` matches the creator.
2. `POST /tenant/users` again with the same `username`.
   - **Expect**: `409` (duplicate username within company — FR-014).
3. `POST /tenant/users` with `role: company_admin` and a fresh username.
   - **Expect**: `201` — confirms Company Admins can create peer admins (FR-019).
4. `POST /tenant/users` with `role: student` (or omit role/attempt `system_admin`).
   - **Expect**: rejected (`400`/`403`) — Company Admin cannot create Student or System Admin accounts (FR-018/FR-019).
5. `PATCH /tenant/users/{userId}/status` with `{"status": "inactive"}` on the Staff account from step 1.
   - **Expect**: `200`; a subsequent login attempt for that account (auth feature) fails while the account's historical record remains queryable.

## Scenario 4 — Student self-registration (User Story 4)

1. `POST /auth/register` on the company from Scenario 1/2, with `category_id` set to the "Student" category created in Scenario 2 and no `department_id`.
   - **Expect**: `201`, `role: student`, `department_id: null`.
2. Repeat with the same `username`.
   - **Expect**: `409` duplicate-username (FR-014).
3. `POST /auth/register` on a **different** company using the **same** `username` (mobile number) as step 1.
   - **Expect**: `201` — a separate, independent account under the other company (FR-013, edge case in spec).
4. Attempt `POST /auth/register` omitting `category_id`.
   - **Expect**: `400` — Category is required (FR-011).

## Scenario 5 — System Admin platform-wide management (User Story 5)

1. As System Admin, `GET /admin/categories` and `GET /admin/departments`.
   - **Expect**: `200`, entries from every company created so far, each correctly attributed via `company_id`.
2. As System Admin, `PATCH /admin/categories/{categoryId}` on a category belonging to Company A (edit its name).
   - **Expect**: `200`; a subsequent `GET /tenant/categories` as Company A's own Company Admin reflects the change.
3. Attempt the same `GET /admin/categories` call as a Company Admin, Staff, or Student JWT.
   - **Expect**: `403` for all three — platform-wide management is System-Admin-exclusive (FR-005/FR-021).

## Pass/Fail

All scenarios above should produce the **Expect** outcome exactly. Any deviation — especially cross-tenant data appearing in a response, or a non-System-Admin reaching an `/admin/*` route — is a blocking failure per SC-004 and must not ship.
