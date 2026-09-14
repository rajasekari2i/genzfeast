---

description: "Task list template for feature implementation"
---

# Tasks: Feedback Management

**Input**: Design documents from `/specs/016-feedback-management/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md (all present)

**Tests**: Not included. Per this project's own standing convention (CLAUDE.md "Testing & Quality" / `feedback_defer_tests` memory), implementation comes first here — the automated test suite (mocked-DB unit/contract tests covering `quickstart.md`'s scenarios) is a separate follow-up step once explicitly requested, not part of this task list.

**Organization**: Tasks are grouped by user story (spec.md: US1 = Submit Feedback P1, US2 = Company Admin Reviews P2, US3 = Company Admin Resolves P3) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 / US2 / US3, per spec.md's priorities
- Every task names an exact file path

## Path Conventions

Existing repo layout (per plan.md's Project Structure, confirmed against the real `api/`/`mobile/` trees — not a fresh scaffold): `api/src/<module>/` (NestJS + Prisma) and `mobile/src/screens/{shared,tenant-admin-staff}/` (React Native).

---

## Phase 1: Setup

**Purpose**: The one piece of shared groundwork with zero dependencies on the schema/module work below.

- [ ] T001 [P] Create the fixed Feedback Category const object + derived union type (`app_experience`, `food_order_quality`, `payment_issue`, `pickup_experience`, `suggestion`, `other`) in `api/src/feedback/feedback-category.constants.ts`, following the `OrderStatus`-style pattern in `coding_standard.md` §2 (research.md §1)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The `feedback` table, its RLS/audit wiring, and the NestJS module registration — nothing in Phase 3+ can be implemented or tested until this phase is done.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T002 Add `model Feedback` to `api/prisma/schema.prisma` — `id`, `companyId` (`@map("company_id")`), `userId` (`@map("user_id")`), `rating` (nullable `Int` @db.SmallInt), `category` (`String`), `message` (`String`), `contactRequested` (`Boolean` @map("contact_requested") default false), `status` (`String` default `"new"`), `isDeleted` (`Boolean` @map("is_deleted") default false), `createdBy`/`updatedBy` (nullable `String?` @db.Uuid), `createdAt`/`updatedAt` (`@updatedAt` on the latter) — relations to `Company` and `User` (via `userId`, and via `createdBy`/`updatedBy` as separate named relations, matching the `Order` model's existing pattern) — per data-model.md §1
- [ ] T003 Run `prisma migrate dev --create-only --name feedback` to generate the Prisma-side `CREATE TABLE feedback` + FK migration SQL, then hand-edit `api/prisma/migrations/<generated-timestamp>_feedback/migration.sql` to append, below a "HAND-ADDED BELOW THIS LINE" comment block (`coding_standard.md` §4.2): the four `CHECK` constraints (`rating BETWEEN 1 AND 5` or NULL, `category IN (...)`, `char_length(message) BETWEEN 1 AND 1000`, `status IN ('new','resolved')`) and the two indexes `(company_id, status)` and `(company_id, created_at DESC)` — per data-model.md §1
- [ ] T004 In the same migration file from T003, add `GRANT SELECT, INSERT, UPDATE ON feedback TO app_user;` (no DELETE), then `ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;` and the single `feedback_tenant_isolation` `FOR ALL` policy (`company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid`, both `USING` and `WITH CHECK`) — per data-model.md's Row Level Security section, deliberately with no `system_admin` bypass predicate
- [ ] T005 In the same migration file from T003, attach the existing `fn_audit_log()` function as `CREATE TRIGGER audit_feedback AFTER INSERT OR UPDATE ON feedback FOR EACH ROW EXECUTE FUNCTION fn_audit_log();` — per research.md §2 (no changes to `fn_audit_log()` itself or to the `audit_logs` table)
- [ ] T006 Update the `AuditLog` Prisma model's doc-comment in `api/prisma/schema.prisma` (currently states the trigger is "attached to those three tables") to reflect that it is now attached to four tables, including `feedback` — per research.md §2
- [ ] T007 Apply the migration from T003–T005 against a local/dev Postgres instance and confirm it runs cleanly end-to-end before it is ever committed (`coding_standard.md` §11 — never commit an unrun migration)
- [ ] T008 [P] Create `api/src/feedback/feedback.module.ts` (empty `@Module` shell — controller/providers arrays populated as each user story below adds them) and register `FeedbackModule` in `api/src/app.module.ts`, matching how `ProductsModule`/`ProfileModule` are already registered there

**Checkpoint**: Schema, RLS, audit trigger, and module registration are in place — user story implementation can now begin.

---

## Phase 3: User Story 1 - Submit Feedback About the Canteen (Priority: P1) 🎯 MVP

**Goal**: Any signed-in tenant user (Student, Teaching, Non-Teaching, Company Staff, Company Admin) can submit a rating/category/message/contact-back-request and get a tenant-named confirmation.

**Independent Test**: Per spec.md — open the Feedback page as any in-scope role, fill Category + Message (optionally Rating and "Contact me back"), tap Submit, and verify a `feedback` row is created tagged with that user's own `company_id`, `status = "new"`, and the confirmation copy names the tenant.

### Implementation for User Story 1

- [ ] T009 [P] [US1] Create `CreateFeedbackDto` in `api/src/feedback/dto/create-feedback.dto.ts` — `rating?: number` (`@IsInt() @Min(1) @Max(5) @IsOptional()`), `category: string` (`@IsIn(FeedbackCategory values from T001)`), `message: string` (`@IsString() @MinLength(1) @MaxLength(1000)`), `contactRequested?: boolean` (`@IsBoolean() @IsOptional()`) — per contracts/openapi.yaml `FeedbackCreateRequest`
- [ ] T010 [P] [US1] Create `api/src/feedback/feedback.mapper.ts` with a `toResponse()` function mapping a Prisma `Feedback` row (joined with its `user` for `name`) to the `Feedback` response shape (`id`, `company_id`, `rating`, `category`, `message`, `contact_requested`, `status`, `submitted_by: {id, name}`, `created_at`, `updated_at`) — per contracts/openapi.yaml `Feedback` schema
- [ ] T011 [US1] Implement `FeedbackService.create()` in `api/src/feedback/feedback.service.ts` — writes through `TenantPrismaService.runInTenantContext` using the caller's JWT-derived `{userId, role, companyId}` (never a client-supplied `company_id`), sets `userId`/`createdBy`/`updatedBy` to the caller, leaves `status` at its DB default of `"new"` (depends on T002–T008, T009)
- [ ] T012 [US1] Implement `POST /me/feedback` in `api/src/feedback/feedback.controller.ts` — `@UseGuards(JwtAuthGuard)` only (no `@Roles(...)` restriction — every authenticated role may call this), `@CurrentUser()` supplies the tenant context, delegates to `FeedbackService.create()`, returns `201` with `feedback.mapper.ts`'s `toResponse()` (depends on T010, T011)
- [ ] T013 [P] [US1] Implement `mobile/src/screens/shared/FeedbackScreen.tsx` — 1–5 star rating (optional), Category dropdown (the six fixed values), Message free-text field, "Contact me back" checkbox that reveals the signed-in user's already-known registered email read-only when checked, Submit button; prompt copy interpolates the tenant's company name ("Tell us more — what happened, or what would make {Tenant Company Name} better?"); on success shows "Thanks! Your feedback helps us improve {Tenant Company Name}." with a link back to Home — per spec.md's feedback-page content list and User Story 1
- [ ] T014 [US1] Wire `FeedbackScreen` into the app's navigation so it is reachable from every in-scope role's menu (Student/Teaching/Non-Teaching in the student-facing navigator, Company Staff/Company Admin in the tenant navigator) (depends on T013)

**Checkpoint**: User Story 1 is fully functional and independently testable via `quickstart.md` Scenario 1.

---

## Phase 4: User Story 2 - Company Admin Reviews Incoming Feedback (Priority: P2)

**Goal**: Company Admin sees a tenant-scoped, status-filterable list of feedback, with contact email surfaced on request.

**Independent Test**: Per spec.md — seed feedback records across companies/statuses; verify the review page shows only the caller's own company's records, newest first, filterable by status, with `contact_email` visible on detail only when `contact_requested` was set; verify a different company's Company Admin gets nothing (list) and `404` (direct detail lookup).

### Implementation for User Story 2

- [ ] T015 [P] [US2] Create `ListFeedbackQueryDto` in `api/src/feedback/dto/list-feedback-query.dto.ts` — optional `status?: 'new' | 'resolved'` per contracts/openapi.yaml `StatusFilterParam`
- [ ] T016 [US2] Implement `FeedbackService.list()` and `FeedbackService.findOne()` in `api/src/feedback/feedback.service.ts` — both scoped through `TenantPrismaService.runInTenantContext`, `list()` ordered `created_at DESC` with an optional status filter, `findOne()` throws `NotFoundException` when the id doesn't resolve under the caller's own company (RLS backs this up independently) (depends on T002–T008)
- [ ] T017 [US2] Extend `api/src/feedback/feedback.mapper.ts` with a `toDetailResponse()` that adds `contact_email` (resolved via the existing join to `users.email` through `created_by`) only when `contact_requested` is true — per research.md §3 and contracts/openapi.yaml `FeedbackDetail` (depends on T010)
- [ ] T018 [US2] Implement `GET /tenant/feedback` and `GET /tenant/feedback/{feedbackId}` in `api/src/feedback/feedback.controller.ts` — `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('company_admin')` (Company Staff and every other role get `403`) (depends on T016, T017)
- [ ] T019 [P] [US2] Implement `mobile/src/screens/tenant-admin-staff/FeedbackListScreen.tsx` — newest-first list, status filter control (New/Resolved), each row shows rating/category/status/contact-requested flag, tap navigates to detail
- [ ] T020 [P] [US2] Implement `mobile/src/screens/tenant-admin-staff/FeedbackDetailScreen.tsx` — full record detail (rating, category, message, status), and the submitter's registered email shown only when `contact_requested` is true
- [ ] T021 [US2] Wire `FeedbackListScreen`/`FeedbackDetailScreen` into the Company Admin navigator only — not exposed to Company Staff (depends on T019, T020)

**Checkpoint**: User Stories 1 and 2 both work independently — verify via `quickstart.md` Scenario 2.

---

## Phase 5: User Story 3 - Company Admin Resolves Feedback (Priority: P3)

**Goal**: Company Admin closes the loop by marking a reviewed item resolved.

**Independent Test**: Per spec.md — as Company Admin, resolve a `new` item and confirm its status flips to `resolved` and it moves between the status filters accordingly; confirm no other role can resolve, and resolving twice is a harmless no-op.

### Implementation for User Story 3

- [ ] T022 [US3] Implement `FeedbackService.resolve()` in `api/src/feedback/feedback.service.ts` — via `TenantPrismaService.runInTenantContext`, sets `status = 'resolved'`, `updatedBy` = the calling Company Admin's id; if the record is already `resolved`, returns it unchanged rather than erroring (research.md §5) (depends on T002–T008)
- [ ] T023 [US3] Implement `PATCH /tenant/feedback/{feedbackId}/resolve` in `api/src/feedback/feedback.controller.ts` — `@Roles('company_admin')`, no request body, returns the updated record via `feedback.mapper.ts` (depends on T022)
- [ ] T024 [US3] Add a "Resolve" action to `mobile/src/screens/tenant-admin-staff/FeedbackDetailScreen.tsx` that calls the resolve endpoint and updates the displayed status in place, and hide/disable the action once a record is already `resolved` (depends on T020, T023)

**Checkpoint**: All three user stories are independently functional — full `quickstart.md` should now pass end-to-end.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validation and documentation cleanup that spans every story above.

- [ ] T025 [P] Walk through every scenario in `specs/016-feedback-management/quickstart.md` end-to-end against a running dev instance and fix any deviation before considering the feature done
- [ ] T026 [P] Add the new Feedback screens to `docs/ui-screen/06-UI-Design.md` (a Student/shared-app entry alongside §4.x, and a Tenant Admin & Staff App entry alongside §5.x) — confirmed during planning that this doc has no Feedback section yet

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: T002 first (schema); T003 depends on T002; T004 and T005 both hand-edit the same migration file from T003, in order; T006 touches the same `schema.prisma` file as T002 (do after T002, not parallel with it); T007 depends on T003–T005; T008 has no dependency on the Prisma work and can run in parallel with T002–T007. **Blocks all user stories.**
- **User Stories (Phase 3–5)**: All require Phase 2 complete. They can proceed in parallel (different developers) or sequentially in priority order (US1 → US2 → US3); US2 and US3 are easiest to validate meaningfully once US1 exists to generate data, but nothing about their code depends on US1's code.
- **Polish (Phase 6)**: Depends on whichever user stories are in scope for the release being complete.

### Within Each User Story

- US1: T009/T010 (parallel) → T011 → T012; T013 (parallel to the backend chain) → T014.
- US2: T015 (parallel to T016) → T016 → T017 (needs T010) → T018; T019/T020 (parallel to the backend chain) → T021.
- US3: T022 → T023 → T024.

### Parallel Opportunities

- T001 (Setup) has no dependents in its own phase.
- T008 can run in parallel with T002–T007 (Foundational).
- Within US1: T009 and T010 in parallel; T013 in parallel with the T009→T012 backend chain.
- Within US2: T015 in parallel with T016 (T016 doesn't need the DTO to exist to be written, though wiring it in T018 does); T019 and T020 in parallel with each other and with the T016→T018 backend chain.
- Different user stories (US1/US2/US3) can be staffed in parallel once Phase 2 is complete, though US2/US3's manual verification is more meaningful once US1 can produce data.

---

## Parallel Example: User Story 1

```bash
# Launch both independent backend building blocks together:
Task: "Create CreateFeedbackDto in api/src/feedback/dto/create-feedback.dto.ts"
Task: "Create feedback.mapper.ts toResponse() in api/src/feedback/feedback.mapper.ts"

# The mobile screen can be built in parallel with the backend chain:
Task: "Implement FeedbackScreen.tsx in mobile/src/screens/shared/FeedbackScreen.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (T001) and Phase 2 (T002–T008) — the schema/RLS/audit/module foundation.
2. Complete Phase 3 (T009–T014) — feedback capture, end to end.
3. **STOP and VALIDATE** against `quickstart.md` Scenario 1 — feedback is durably captured, correctly tenant-tagged, with no admin-facing surface yet.
4. This is already a shippable increment: even with no review UI, Company Admin/Ops can query the `feedback` table directly for manual follow-up.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. Add US1 → validate independently → MVP.
3. Add US2 → validate independently (`quickstart.md` Scenario 2) → Company Admin can now see the queue.
4. Add US3 → validate independently (`quickstart.md` Scenario 3) → the loop is closed.
5. Polish (T025–T026).

## Notes

- No test tasks are included in this list — per this project's explicit convention, the automated (mocked-DB) test suite covering `quickstart.md`'s scenarios is written as a follow-up once requested, not proactively during implementation.
- `[P]` tasks touch different files with no dependency on an incomplete task; sequential edits to the same file (e.g., T003→T004→T005 all touching one migration file) are never marked `[P]` against each other even when logically independent.
- Commit after each task or logical group, per this repo's small-scoped-commit convention (`coding_standard.md` §11).
