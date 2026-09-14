# Phase 0 Research: Contact Us Page

**Feature**: `015-contact-us-page` | **Date**: 2026-09-14

Depends on `001-company-role-user-setup` (`companies` table, RLS foundation) and, for the read-side module shape, `007-user-profile-management` (`/me/*` controller pattern). This document resolves the remaining implementation-pattern questions the spec's Assumptions section didn't already settle.

## 1. Extending `companies` vs. a new entity

- **Decision**: Add a single nullable `operating_hours text` column to the existing `companies` table. No new table.
- **Rationale**: Already settled in `spec.md`'s Assumptions — Contact Person/Phone/Email/Address are `001`'s existing required `companies` columns; Operating Hours is the only genuinely new attribute, and it is intrinsically a property of the Company record itself, not a separate concept.
- **Alternatives considered**: A standalone `company_contact_info` table (1:1 with `companies`) — rejected as unnecessary indirection for one additional nullable column; it would need its own RLS policy pair duplicating `companies`' own, for no isolation benefit.

## 2. Where the schema/contract change for `operating_hours` lives

- **Decision**: Documented in place in `specs/001-company-role-user-setup/data-model.md` (§1 `companies` table) and `specs/001-company-role-user-setup/contracts/openapi.yaml` (`Company`, `CompanyUpdateRequest` schemas), not re-declared in this feature's own `data-model.md`/`contracts/openapi.yaml`.
- **Rationale**: Established precedent — `companies.is_sms` (migration `20260912190923_company_is_sms_toggle`, actually shipped as part of `014`'s implementation) was documented the same way: added directly to `001`'s `data-model.md` and `contracts/openapi.yaml` rather than duplicated into `014`'s own docs. Keeps exactly one authoritative description of the `Company` shape instead of it drifting across multiple specs' docs.
- **Alternatives considered**: Redeclare the full `Company`/`CompanyUpdateRequest` schema in `015`'s own contract — rejected; `openapi-typescript` generates one `.d.ts` per spec (`mobile/src/api/generated/<spec>.d.ts`, per that directory's own README), so duplicating the schema would produce two diverging type definitions for the same wire shape.

## 3. The `companies` RLS policy currently blocks every non-system_admin read — including one `007` already depends on

- **Finding**: `companies_system_admin_only` (migration `20260905175446_init_company_role_category_department_user`, widened once by `20260908120000_companies_auth_service_read` to add the `auth_service` system-actor bypass) is a single `FOR ALL` policy gated on `current_setting('app.current_role') = 'system_admin'` (or the `auth_service` system actor). No policy grants any other role `SELECT` on `companies` at all. `TenantPrismaService.runInTenantContext` sets `app.current_role` to the real caller's role for every request — there is no "read my own company" bypass anywhere in the codebase today.
- **Consequence already in production code**: `ProfileService.getProfile` (`007`) does `tx.user.findFirstOrThrow({ include: { company: true } })` for every role, and `ProfileMapper` reads `user.company?.name` for `company_admin`/`company_staff` (PRD FR-002's "Company they belong to"). Under the current RLS policy, that join's own implicit `SELECT` on `companies` is denied, so `user.company` resolves to `undefined` and the Profile screen has been silently showing no company name for those two roles since `007` shipped.
- **Decision**: Add one new, additive policy: `companies_tenant_self_read`, `FOR SELECT ONLY`, `USING (company_id = current_setting('app.current_company_id', true)::uuid)`. Postgres RLS OR's multiple permissive policies together per operation — this adds a second allow-path for `SELECT` only; `INSERT`/`UPDATE`/`DELETE` remain gated solely by the existing `companies_system_admin_only` policy, so no write capability leaks to any tenant role.
- **Side effect noted, not separately scoped**: this also fixes `007`'s dormant company-name gap, since it's the same underlying `SELECT` path. No `007` code changes — the fix is entirely in the new RLS policy.
- **Alternatives considered**: Route the read through a `system_actor`-style bypass (like `auth_service`) instead of a real per-row policy — rejected; that pattern is reserved for genuinely pre-authentication/no-real-user code paths (login/registration), not for an authenticated user reading their own tenant's data, where a real row-level predicate is both simpler and tighter.

## 4. System Admin write path: reuse `PATCH /admin/companies/{companyId}` vs. a new endpoint

- **Decision**: Reuse the existing endpoint, extended with an optional `operating_hours` field on `UpdateCompanyDto`. No new admin API endpoint.
- **Rationale**: The spec's FR-003 requirement for "a dedicated Contact Us management screen distinct from the company onboarding/edit screen" is a **mobile UI/navigation** requirement (a different screen, a different entry point from `CompanyListScreen`), not a backend contract requirement — the underlying write is still "update this company's record," identical in shape to what `CompanyCreateEditScreen` already does today. Introducing a second write endpoint for the same row would duplicate `companies.service.ts#update`'s validation/audit path for no isolation or UX benefit.
- **Alternatives considered**: A dedicated `PATCH /admin/companies/{companyId}/contact-us` sub-resource — rejected as unnecessary duplication; revisit only if a future spec gives Contact Us fields different write permissions than the rest of the Company record (e.g., delegating them to Company Admin while keeping Name/`is_open` System-Admin-only), which no current spec does.

## 5. New read endpoint shape: `GET /me/contact-us`

- **Decision**: New `contact-us/` module, `@Controller('me')` (a second controller class sharing the `/me` prefix with `profile/`'s `ProfileController` — permitted in Nest as long as sub-paths don't collide; `/me/contact-us` vs `/me/profile` don't), guarded by `@Roles('company_admin', 'company_staff', 'student', 'teaching', 'non_teaching')` — an explicit allowlist, not `profile/`'s "no `@Roles()`, open to every authenticated role" shape, since System Admin is explicitly *not* a Contact Us viewer (spec Assumptions) and has no `company_id` to scope the query by in the first place.
- **Rationale**: Mirrors `007`'s `/me/*` pattern (identity and scoping from the verified JWT via `TenantContextInterceptor`, zero path/query parameters) for a read that is, structurally, the same "authenticated user reads something scoped to their own claims" shape — but needs its own explicit role list where `profile/` didn't, because `profile/` legitimately serves System Admin too (their own profile) while this endpoint doesn't apply to System Admin at all.
- **First real capability for `teaching`/`non_teaching`**: CLAUDE.md notes these two roles exist in the `roles` catalog but "no `@Roles(...)` guard, endpoint, or capability references it yet — treat as reserved/undefined until a spec assigns it real permissions." `015` is that spec, for exactly this one capability (view-only Contact Us) — no other endpoint or guard is extended to them here.
- **Alternatives considered**: Fold this into `ProfileController`/`ProfileService` as an extra field on `GET /me/profile` — rejected; Contact Us is conceptually a Company-level fact, not a User-level one, and bundling it would force every profile read to also join/return company contact fields even for System Admin, who shouldn't see this data via any path.

## 6. Operating Hours field shape

- **Decision**: Single free-text field (e.g. `"Mon–Sat, 9:00 AM – 8:00 PM"`), optional, reasonable length cap (255 chars, matching the informal convention already used for `companies.address`/`contact_person`, which are unbounded `text` at the DB layer but always presented through a single-line/short-paragraph input on the existing Company form).
- **Rationale**: Already settled in `spec.md`'s Assumptions — no structured per-day schedule; nothing in the source PRD/BRD calls for that granularity, and every other `companies` field is already free text.

## 7. Tap-to-call / tap-to-email

- **Decision**: React Native's built-in `Linking` API — `Linking.openURL('tel:' + phoneNumber)` and `Linking.openURL('mailto:' + email)`. No new dependency; no backend involvement.
- **Rationale**: Native URI schemes are the standard, zero-dependency way to hand off to the device's own phone/mail app from a React Native screen; matches the spec's Assumption that these actions "rely on native device capability already assumed available on any phone running this app."

## 8. Phone Number format validation (FR-007)

- **Finding**: FR-007 requires validating both Email *and* Phone Number format on every System Admin save. `api/src/companies/dto/update-company.dto.ts` and `create-company.dto.ts` currently validate `email` (`@IsEmail()`) but `mobile` has only `@IsString()` — no format check at all, on either DTO, today.
- **Decision**: Add `@Matches(/^\d{10}$/, { message: 'mobile must be a 10-digit mobile number' })` to `mobile` on both `CreateCompanyDto` and `UpdateCompanyDto` (tasks.md T004/T005) — the exact pattern already enforced on every other mobile-number field in the codebase (`register-student.dto.ts`, `send-mobile-verification.dto.ts`, `verify-mobile.dto.ts`, all `@Matches(/^\d{10}$/, ...)`).
- **Rationale**: FR-007 doesn't scope itself to only the fields this feature adds — it applies to "every System Admin save" of Contact Us data, and Phone Number is one of the five Contact Us fields even though the column itself predates this feature. Since this feature is already touching both DTOs, closing this pre-existing gap here is the only place it can be closed without a separate, unrelated feature. `CreateCompanyDto` is included too (not just `UpdateCompanyDto`) since FR-007 says "every ... save," and a newly-created Company with an unvalidated phone number would otherwise still be able to reach an update later with the same bad value silently accepted only for other fields.
- **Alternatives considered**: Scope the fix to `UpdateCompanyDto` only (touch fewer files) — rejected; would leave `POST /admin/companies` (create) still accepting a malformed phone number, contradicting FR-007's "every ... save."
