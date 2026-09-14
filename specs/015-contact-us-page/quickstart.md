# Quickstart: Contact Us Page

**Feature**: `015-contact-us-page` | **Date**: 2026-09-14

Validates `spec.md`'s three user stories end-to-end. Assumes a running API (`api/`) against a seeded Supabase Postgres instance with at least one Company that has a Company Admin, a Company Staff, and a Student account (reuse any prior feature's seed data), plus the System Admin bootstrap account (`012-bootstrap-system-admin-seed`).

## Prerequisites

- Migration applied: `operating_hours` column + `companies_tenant_self_read` policy on `companies` (data-model.md §1-2).
- At least two distinct Companies exist, so cross-tenant isolation (US1 Scenario, FR-002) can be checked.

## Scenario 1 — Tenant view, before Operating Hours is set (US1)

1. Log in as a Company Admin (or Staff/Student/Teaching/Non-Teaching) of Company A.
2. `GET /me/contact-us`.
3. **Expect**: 200, `contact_person`/`phone_number`/`email`/`address` populated from Company A's record, `operating_hours: null`.
4. On the mobile app, open the "Contact Us" drawer item.
5. **Expect**: all four required fields shown; Operating Hours shows a clear "Not specified" state, not a blank line.

## Scenario 2 — System Admin sets Contact Us details (US2)

1. Log in as System Admin.
2. Open Company List → select Company A → open its (new) Contact Us management screen.
3. Submit valid `contact_person`, `mobile`, `email`, `address`, and `operating_hours` via `PATCH /admin/companies/{companyId}`.
4. **Expect**: 200, updated values reflected in the response.
5. Repeat Scenario 1 as a Company A user (no re-login needed if session still valid).
6. **Expect**: the same updated values now appear, including the previously-null `operating_hours`.

## Scenario 3 — Cross-tenant isolation (FR-002)

1. Log in as a Student of Company B.
2. `GET /me/contact-us`.
3. **Expect**: 200, Company B's own contact info only — never Company A's.
4. (RLS check) Confirm at the database layer that a session with `app.current_company_id` = Company B's id cannot `SELECT` Company A's row even via a raw query — the new `companies_tenant_self_read` policy should reject it.

## Scenario 4 — Only System Admin may write (FR-004)

1. Log in as a Company Admin of Company A.
2. Attempt `PATCH /admin/companies/{companyId}` for Company A's own id.
3. **Expect**: 403 — `admin/companies` stays `@Roles('system_admin')`-only, unchanged by this feature.

## Scenario 5 — Invalid submission is all-or-nothing (FR-007, FR-008)

1. Log in as System Admin.
2. Submit a Contact Us update with a malformed `email` (e.g. `"not-an-email"`).
3. **Expect**: 400, field-specific validation error; re-fetch the company and confirm none of the other submitted fields (e.g. a simultaneously-submitted new `contact_person`) were saved either.
4. Repeat with a malformed `mobile` (e.g. `"12345"` — not 10 digits) instead of a bad email.
5. **Expect**: 400, field-specific validation error for `mobile`; nothing saved. Repeat once more against `POST /admin/companies` (create, not update) with the same malformed `mobile` — same rejection (research.md §8).

## Scenario 6 — Quick-contact actions (US3, manual mobile check)

1. On the Contact Us screen, tap the Phone Number.
2. **Expect**: device offers to place a call to that exact number.
3. Tap the Email.
4. **Expect**: device offers to compose a message to that exact address.
5. Confirm the Address is plain, non-interactive text (no map action).

## Scenario 7 — Closed company still shows contact info (Edge case, FR-009)

1. As System Admin, set Company A's `is_open` to `false` (existing `PATCH /admin/companies/{companyId}` behavior, unchanged).
2. As a Company A user, `GET /me/contact-us` again.
3. **Expect**: 200, same contact details as before — unaffected by `is_open`.
