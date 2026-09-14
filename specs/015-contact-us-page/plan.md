# Implementation Plan: Contact Us Page

**Branch**: `015-contact-us-page` | **Date**: 2026-09-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/015-contact-us-page/spec.md`

## Summary

Add one new optional column (`operating_hours`) to the existing `companies` record (`001-company-role-user-setup`) and surface all five Contact Us fields — Contact Person, Phone Number (`mobile`), Email, Address, Operating Hours — two ways: (1) a new read-only `GET /me/contact-us` endpoint + mobile screen for Company Admin/Company Staff/Student/Teaching/Non-Teaching, scoped to the caller's own company; (2) a System Admin management screen, reusing the existing `PATCH /admin/companies/{companyId}` endpoint (extended with `operating_hours`), reachable from a new entry point distinct from the existing Company onboarding screen. This requires one migration (new column + one new RLS `SELECT` policy) — no new entity.

**Notable side effect**: the existing `companies_system_admin_only` RLS policy currently blocks *all* non-system_admin reads of `companies`, including the join `007-user-profile-management`'s `ProfileService` already performs (`include: { company: true }`) to show a Company Admin/Staff's company name on their own Profile screen. That join has therefore been silently returning no company data since `007` shipped. The new `SELECT` policy this feature adds (own-company-row, read-only) fixes that dormant gap as a side effect — it is not separately re-scoped as part of `015`, just noted here since the fix lands in the same migration.

## Technical Context

**Language/Version**: TypeScript (Node.js 20 LTS) for the API — unchanged from prior features; TypeScript/React Native (bare CLI, per `mobile/scripts/generate-api-types.sh`) for mobile — unchanged

**Primary Dependencies**: NestJS (reused); Prisma (reused) for the new `operating_hours` column; `class-validator` (reused) for the extended `UpdateCompanyDto`/`CreateCompanyDto` — including closing a pre-existing gap by adding `@Matches(/^\d{10}$/, ...)` to `mobile` on both, the same pattern already used by `register-student.dto.ts` (FR-007, research.md §8); React Native `Linking` (already a core RN API, no new dependency) for tap-to-call/tap-to-email

**Storage**: Supabase-managed PostgreSQL — one migration: `ALTER TABLE companies ADD COLUMN operating_hours text NULL;` plus one new RLS policy (`companies_tenant_self_read`, `FOR SELECT`)

**Testing**: Deferred per project direction (CLAUDE.md — "implement first, tests later, on explicit request")

**Target Platform**: Same containerized Node.js API; mobile screens per UI Design's existing Student/Tenant Admin & Staff/System Admin surfaces (this feature adds a new "Contact Us" screen + drawer item, and a new System Admin management screen, neither present in the current UI Design doc — both follow that doc's existing form/list conventions)

**Performance Goals**: Same <300ms perceived-latency NFR as prior features; no new performance-sensitive path

**Constraints**: A tenant user MUST NEVER read another company's Contact Us data (FR-002); only System Admin may write Contact Us fields, for any company (FR-004); Operating Hours is the only optional field among the five — its absence must render as an explicit "not specified" state, never a blank/broken layout (FR-005)

**Scale/Scope**: Same tenant/user scale as prior features; lowest-complexity module so far after `007` — one column, one new read endpoint, one extended write endpoint, three new/changed mobile screens

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

As in prior features, `.specify/memory/constitution.md` remains an unfilled template; `docs/architecture/04-Architecture.md` §6 (two-layer tenant isolation: API-layer `company_id` filtering + independent Postgres RLS) and §11's own stated mapping govern this feature directly. Checked against those:

- **API-layer scoping**: `GET /me/contact-us` derives the target company exclusively from `ctx.companyId` (verified JWT claim via `TenantContextInterceptor`) — never from a path/query/body parameter. No cross-tenant parameter exists anywhere in the read path. ✅
- **Independent RLS re-check**: the new `companies_tenant_self_read` policy re-derives the same scoping at the database layer (`company_id = current_setting('app.current_company_id')`), so an API-layer bug alone could never leak another tenant's contact info — consistent with the BRD's named top risk. ✅
- **System Admin's cross-tenant reach stays a narrow, explicit predicate** (`current_setting('app.current_role') = 'system_admin'`) on the existing `companies_system_admin_only` policy, not a blanket `BYPASSRLS` — unchanged by this feature. ✅
- **No new entity**: extends `companies` (`001`) with one nullable column; no new roles, no new tenant-scoped table. ✅
- **Auditability**: `companies` is already a business-critical table covered by the platform's `audit_logs` trigger (`011-audit-logs-product-order-payment`) — a System Admin's `operating_hours`/contact-field edit is captured automatically, no new application-level logging needed. ✅

**Result**: PASS. No entries required in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/015-contact-us-page/
├── spec.md
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── openapi.yaml      # Phase 1 output (/speckit-plan command) — the one NEW endpoint only
└── tasks.md               # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

`operating_hours`'s schema/contract addition to the existing `Company`/`CompanyUpdateRequest` shapes is documented in place in `specs/001-company-role-user-setup/data-model.md` and `specs/001-company-role-user-setup/contracts/openapi.yaml` — the same convention that feature's own `is_sms` column (added later, by `014`'s implementation) already follows, rather than re-declaring the whole `Company` shape here.

### Source Code (repository root)

Extends the `api/` and `mobile/` structures from prior features. Touches `companies/` (extend, no new files) and `prisma/schema.prisma` + one migration; adds a new `contact-us/` module (mirrors `profile/`'s `/me/*` pattern). No existing module's behavior changes other than `companies`' DTO/mapper and the RLS policy.

```text
api/
├── prisma/
│   ├── schema.prisma                 # Company model: + operatingHours
│   └── migrations/
│       └── <timestamp>_contact_us_operating_hours/
│           └── migration.sql          # ADD COLUMN + companies_tenant_self_read policy
└── src/
    ├── companies/
    │   ├── companies.controller.ts    # unchanged (existing PATCH /admin/companies/{companyId} now accepts operating_hours)
    │   ├── companies.service.ts        # update(): + operating_hours passthrough
    │   ├── companies.mapper.ts         # toCompanyResponse(): + operating_hours
    │   └── dto/update-company.dto.ts   # + operating_hours (optional, string, maxLength)
    └── contact-us/                     # NEW module
        ├── contact-us.module.ts
        ├── contact-us.controller.ts    # GET /me/contact-us
        ├── contact-us.service.ts        # reads the caller's own company row
        └── contact-us.mapper.ts         # Company row → { contact_person, phone_number, email, address, operating_hours }

mobile/
└── src/
    ├── api/generated/
    │   └── 015-contact-us-page.d.ts     # generated (npm run api:generate) from this feature's contracts/openapi.yaml
    ├── screens/
    │   ├── shared/
    │   │   └── ContactUsScreen.tsx       # NEW — read-only view, all 5 tenant roles, tap-to-call/tap-to-email
    │   └── system-admin/
    │       └── CompanyContactUsScreen.tsx  # NEW — System Admin edit screen, one company at a time
    └── navigation/
        ├── AppShell.tsx                 # + "Contact Us" drawer item for every non-system_admin role
        ├── ProfileNavigator.tsx or a new ContactUsNavigator.tsx  # wraps ContactUsScreen (single-screen stack, same shape as ProfileNavigator before edit/change-password were added)
        └── SystemAdminNavigator.tsx      # + CompanyContactUs route, reached from CompanyListScreen's row actions
```

**Structure Decision**: Mobile + API split (existing `api/` + `mobile/` top-level layout, unchanged from every prior feature). Backend: extend `companies/` in place for the write side (System Admin), add a new `contact-us/` module for the read side (tenant roles) — mirrors how `profile/` (`007`) was kept separate from `companies/`/`users/` despite reading the same underlying tables, since the two modules have entirely different `@Roles()` shapes. Mobile: one new shared screen (read) + one new System Admin screen (write), plus the minimum navigation wiring to reach both.

## Complexity Tracking

*No violations — table intentionally omitted.*
