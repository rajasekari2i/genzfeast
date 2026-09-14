---
description: "Task list for 015-contact-us-page"
---

# Tasks: Contact Us Page

**Input**: Design documents from `/specs/015-contact-us-page/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: Not included — deferred per project direction (CLAUDE.md: implement first, tests on explicit request).

**Organization**: Grouped by user story. Backend (`api/`) and Mobile (`mobile/`) tasks are interleaved within each phase but distinctly labeled so they map cleanly to two separate GitHub issues (`[015] Backend: ...` / `[015] Mobile: ...`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1/US2/US3 per spec.md
- Every task names its exact file path(s)

---

## Phase 1: Setup

**Purpose**: The one shared schema change every other task depends on.

- [ ] T001 Create migration `api/prisma/migrations/<timestamp>_contact_us_operating_hours/migration.sql`: `ALTER TABLE companies ADD COLUMN operating_hours text;` and `CREATE POLICY companies_tenant_self_read ON companies FOR SELECT USING (id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);` (data-model.md §1-2, research.md §3)
- [ ] T002 [P] Update `api/prisma/schema.prisma` — add `operatingHours String? @map("operating_hours")` to the `Company` model; run `npx prisma generate`

**Checkpoint**: Column + RLS policy exist; Prisma client regenerated.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared infrastructure both user stories build on.

**⚠️ CRITICAL**: Must complete before Phase 3/4 work.

- [ ] T003 Scaffold `api/src/contact-us/contact-us.module.ts` (empty controller/service providers) and register `ContactUsModule` in `api/src/app.module.ts`
- [ ] T004 [P] Extend `api/src/companies/dto/update-company.dto.ts` — add optional `operating_hours` (`@IsOptional() @IsString() @MaxLength(255)`) and change `mobile` from `@IsString()` to `@Matches(/^\d{10}$/, { message: 'mobile must be a 10-digit mobile number' })` (FR-007 — closes a pre-existing gap: no phone-format validation exists on this DTO today; research.md §8)
- [ ] T005 [P] Extend `api/src/companies/dto/create-company.dto.ts` — same `mobile` `@Matches(/^\d{10}$/, ...)` change as T004, so `POST /admin/companies` enforces the same format FR-007 requires on updates (research.md §8)
- [ ] T006 Update `api/src/companies/companies.service.ts`'s `update()` to persist `operating_hours` when present in the DTO (depends on T004)
- [ ] T007 [P] Update `api/src/companies/companies.mapper.ts`'s `toCompanyResponse` to include `operating_hours` in the response

**Checkpoint**: `contact-us` module wired into the app; System Admin's existing write path (`PATCH /admin/companies/{companyId}` and `POST /admin/companies`) already accepts/returns `operating_hours` and validates `mobile`'s format — this alone completes US2's backend half.

---

## Phase 3: User Story 1 - View My Canteen's Contact Us Info (Priority: P1) 🎯 MVP

**Goal**: Every tenant role (Company Admin, Company Staff, Student, Teaching, Non-Teaching) can view their own company's Contact Us details, read-only.

**Independent Test**: Log in as each of the five tenant roles; `GET /me/contact-us` returns that user's own company's data; the mobile Contact Us screen renders it, with "Not specified" for an unset Operating Hours.

### Backend

- [ ] T008 [US1] Implement `api/src/contact-us/contact-us.mapper.ts` — maps a `Company` row to `{ contact_person, phone_number, email, address, operating_hours }` (contracts/openapi.yaml `ContactUs` schema)
- [ ] T009 [US1] Implement `api/src/contact-us/contact-us.service.ts#getContactUs(ctx)` — reads the caller's own company row via `TenantPrismaService.runInTenantContext` (`tx.company.findFirstOrThrow({ where: { id: ctx.companyId } })`)
- [ ] T010 [US1] Implement `api/src/contact-us/contact-us.controller.ts` — `GET /me/contact-us` under `@Controller('me')`, `@UseGuards(JwtAuthGuard, RolesGuard)`, `@UseInterceptors(TenantContextInterceptor)`, `@Roles('company_admin', 'company_staff', 'student', 'teaching', 'non_teaching')` (research.md §5 — explicit allowlist, system_admin excluded)

### Mobile

- [ ] T011 [P] [US1] Run `npm run api:generate` in `mobile/` to produce `mobile/src/api/generated/015-contact-us-page.d.ts` (also regenerates `001-company-role-user-setup.d.ts`, since `operating_hours` was added to that spec's contract)
- [ ] T012 [US1] Create `mobile/src/screens/shared/ContactUsScreen.tsx` — fetches `GET /me/contact-us` on mount, renders Contact Person/Phone Number/Email/Address/Operating Hours, "Not specified" state when `operating_hours` is null (FR-005)
- [ ] T013 [US1] Create `mobile/src/navigation/ContactUsNavigator.tsx` — single-screen stack wrapping `ContactUsScreen` (same minimal shape `ProfileNavigator.tsx` had before Edit/Change Password existed)
- [ ] T014 [US1] Wire a "Contact Us" drawer item into `mobile/src/navigation/AppShell.tsx`, mounted for every role except `system_admin` (mirrors how "Profile" is mounted unconditionally today, but excluding `system_admin` here per spec Assumptions)

**Checkpoint**: US1 fully functional — any tenant role can view their own Contact Us page.

---

## Phase 4: User Story 2 - System Admin Masters Contact Us Details Per Company (Priority: P1)

**Goal**: System Admin can view and edit any company's Contact Us details from a dedicated screen, separate from the existing Company onboarding screen.

**Independent Test**: Log in as System Admin, open the new Contact Us management screen for a company, submit new values, confirm they're saved and that the same company's US1 view reflects the change afterward.

**Backend**: No new tasks — fully covered by Phase 2 (T004-T007); the existing `PATCH /admin/companies/{companyId}` endpoint (unchanged `@Roles('system_admin')`) already accepts/returns `operating_hours` and validates `mobile`.

### Mobile

- [ ] T015 [US2] Create `mobile/src/screens/system-admin/CompanyContactUsScreen.tsx` — form for Contact Person/Phone/Email/Address/Operating Hours only (not Name/`is_open`/`is_sms`); fetches via `GET /admin/companies` and finds the matching row by id (same no-GET-by-id pattern `CompanyCreateEditScreen.tsx` already uses); submits via `PATCH /admin/companies/{companyId}`
- [ ] T016 [US2] Add a `CompanyContactUs: { companyId: string }` route to `mobile/src/navigation/SystemAdminNavigator.tsx`'s `SystemAdminStackParamList` and register the `Stack.Screen`
- [ ] T017 [US2] Add a "Contact Us" action to `mobile/src/screens/system-admin/CompanyListScreen.tsx`'s row action area (alongside the existing Edit/Delete `RowActionButton`s — not Edit/Create Admin; `CreateCompanyAdmin` is registered in `SystemAdminNavigator.tsx` but unreachable from any screen today, unrelated to this task) — as a plain new `Pressable`/`Text` element, **not** a third `RowActionButton` variant, since that component hardcodes `variant: 'edit' | 'delete'` with fixed visible text (`RowActionButton.tsx`) and is shared by 6 other screens (`DepartmentListScreen.tsx`, `UserListScreen.tsx` ×2, `CategoryListScreen.tsx`, `ProductListScreen.tsx`) — out of scope to modify here (research.md §9). Navigates to `CompanyContactUs`.

**Checkpoint**: US1 + US2 both independently functional — System Admin can master the data; every tenant role sees the result.

---

## Phase 5: User Story 3 - Quick-Contact Actions (Priority: P2)

**Goal**: Tapping the phone number or email on the Contact Us screen hands off to the device's own call/mail app.

**Independent Test**: Open Contact Us as any tenant role; tap the phone number and confirm the device offers to call that exact number; tap the email and confirm it offers to compose to that exact address.

### Mobile

- [ ] T018 [P] [US3] Add tap-to-call to the Phone Number field in `mobile/src/screens/shared/ContactUsScreen.tsx` (`Linking.openURL('tel:' + phoneNumber)`)
- [ ] T019 [P] [US3] Add tap-to-email to the Email field in `mobile/src/screens/shared/ContactUsScreen.tsx` (`Linking.openURL('mailto:' + email)`); Address stays plain, non-interactive text (FR-010)

**Checkpoint**: All three user stories independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T020 [P] Run `specs/015-contact-us-page/quickstart.md` Scenarios 1-7 end-to-end, including Scenario 5's malformed-phone-number check (FR-007)
- [ ] T021 Regression-check `specs/007-user-profile-management/quickstart.md`'s Company-name-on-Profile scenario for `company_admin`/`company_staff` — confirm the dormant read gap (research.md §3) is now fixed by `companies_tenant_self_read`, with no code change needed in `007`'s own files

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Phase 1 — blocks Phase 3 and Phase 4.
- **US1 (Phase 3)**: Depends on Phase 2. Independent of US2/US3.
- **US2 (Phase 4)**: Depends on Phase 2 only (not on US1) — its backend half is already done by Phase 2.
- **US3 (Phase 5)**: Depends on US1's `ContactUsScreen.tsx` existing (T012).
- **Polish (Phase 6)**: Depends on US1 + US2 (+ US3 if in scope) being complete.

### Parallel Opportunities

- T001/T002 (Phase 1) can run together.
- T004/T005/T007 (Phase 2) can run together (different files); T006 depends on T004.
- Within US1: T008 → T009 → T010 are sequential (same module, each depends on the last); T011 (mobile codegen) can start as soon as Phase 2 + T008-T010 land; T012-T014 are sequential (screen → navigator → drawer wiring).
- US2's mobile tasks (T015-T017) can proceed in parallel with US1's mobile tasks (T011-T014) once Phase 2 is done — different files.
- T018/T019 (US3) can run together (same file, but independent field-level changes — coordinate if done by the same person in one pass).

## Implementation Strategy

### MVP First

1. Phase 1 → Phase 2 → Phase 3 (US1). Stop and validate: every tenant role can view Contact Us.

### Incremental Delivery

1. Phase 1 + 2 → foundation ready.
2. Phase 3 (US1) → tenant view ships (read-only, Operating Hours always "Not specified" until Phase 4 ships).
3. Phase 4 (US2) → System Admin can now actually set the data.
4. Phase 5 (US3) → tap-to-call/email convenience layer.
5. Phase 6 → validation pass.
