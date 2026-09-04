# Module 1: Platform Admin (System Admin)

**Covers:** PRD FR-1
**Depends on:** Data Model (03), Architecture (04)
**Build order:** 1st — must exist before any tenant can be created

## Users
System Admin

## Screens
1. **Company List** — search/list all companies, `is_open` status toggle.
2. **Create/Edit Company** — form: name, contact_person, mobile, email, address.
3. **Create Company Admin** — form: name, username, password (temp), email; auto-assigns `company_admin` role scoped to the created company.

## APIs

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/admin/companies` | Create company |
| GET | `/admin/companies` | List companies |
| PATCH | `/admin/companies/:id` | Update company / toggle `is_open` |
| POST | `/admin/companies/:id/admins` | Create the Company Admin user for a company |

## Business Rules
- Only `system_admin` claim can access this module.
- Creating a company should also seed default `roles` (`company_admin`, `staff`, `student`) scoped to `company_id`.

## Data Touchpoints (see 03-Data-Model.md)
- `companies` (create/update)
- `roles` (seed on company creation)
- `users` (create the first `company_admin` user)

## Acceptance Criteria
- **Given** valid company details, **when** System Admin submits Create Company, **then** a `companies` document is created and default roles are seeded for that `company_id`.
- **Given** a created company, **when** System Admin submits Create Company Admin, **then** a `users` document is created with `role_id` pointing to that company's `company_admin` role and `company_id` set correctly.
- **Given** an existing company, **when** System Admin toggles `is_open` to false, **then** the tenant's Student App should stop allowing new orders (validated in Module 6).
