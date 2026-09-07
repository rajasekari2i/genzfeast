# Tasks: User Profile (View, Edit, Change Password)

**Input**: Design documents from `/specs/007-user-profile-management/` (spec.md, plan.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md)

**Tests**: Included — `plan.md`'s Testing section commits to Jest + Supertest contract tests for role-shaped view, all-or-nothing edit, cross-tenant department rejection, and password-change session-preservation logic.

**Organization**: Tasks are grouped by user story (spec.md priorities P1×3), then Mobile, then Polish. No spec ambiguity was found during task planning — this is the smallest, most self-contained spec so far: zero new tables/migrations (the first such feature), and its one cross-feature dependency (`002`'s session-revocation helper) was already built with this exact caller anticipated.

## Dependency already satisfied (read first)

`002-registration-login-jwt-auth`'s tasks.md T023 already defines `AuthService.revokeAllSessions(userId, exceptRefreshTokenId?)` specifically anticipating "change-password" as one of its two intended future callers (the other being `003`'s forgot-password reset, which already calls it). **This feature is that second caller** — no new session-revocation logic needs to be written here, only a call into the existing helper. If `002`'s T023 hasn't landed yet when this feature is implemented, that one helper (not the whole of `002`) is the actual blocker for User Story 3 only; Stories 1 and 2 (view/edit) have no dependency on `002` beyond the already-built `JwtAuthGuard`.

## Pre-existing foundation (reused, not re-built)

- `JwtAuthGuard` (every route here needs only "authenticated," no role restriction — `@Roles(...)` is not used anywhere in this module).
- `argon2`-based password verify/hash (`002`'s `PasswordService`).
- `TenantPrismaService.runInTenantContext()` for the department-scope lookup (research.md §3, same query shape `001` already uses).
- Mobile: `mobile/src/screens/student/ProfileScreen.tsx` exists today as a single bare stub covering all three UI Design sub-screens (§4.10–§4.12) — Edit Profile and Change Password have no separate screen files yet.

## Phase 1: Setup

- [ ] None — this feature requires no new dependency, env var, or config (research.md §1: zero schema changes, no new library beyond what `001`/`002` already brought in).

---

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T001 Create `ProfileModule` in `api/src/profile/profile.module.ts`, importing `PrismaModule` and (for T007) `002`'s `AuthModule` for its `PasswordService`/`AuthService`; register in `api/src/app.module.ts`

**Checkpoint**: Module scaffolding exists — user story work can begin. (No schema/migration phase — this feature has none.)

---

## Phase 3: User Story 1 - View My Profile (Priority: P1) 🎯 MVP

**Goal**: Any authenticated user sees a role-shaped view of their own account — Name/Username/Email always, plus Category+Department (Student) or Company (Company Admin/Staff), nothing extra for System Admin.

**Independent Test**: Log in as each of the 4 roles and confirm the response shape matches exactly what that role should see, with Username always presented as read-only context.

- [x] T002 [US1] Implement `ProfileService.getProfile(ctx)` in `api/src/profile/profile.service.ts` — looks up the caller's own `users` row by `ctx.userId` (never any other id — FR-014), shapes the response by `ctx.role`: always `name`/`username`/`email`; `category`+`department` only for `student`; `company` only for `company_admin`/`staff`; neither for `system_admin` (FR-001, FR-002)
- [x] T003 [US1] `ProfileController`: `GET /me/profile` in `api/src/profile/profile.controller.ts`, `@UseGuards(JwtAuthGuard)` only — no `@Roles(...)`, per contracts/openapi.yaml
- [ ] T004 [P] [US1] Contract tests in `api/test/contract/profile/view.spec.ts`: each of the 4 roles gets the exactly-correct field shape (Student has `category`/`department`, no `company`; Company Admin/Staff have `company`, no `category`/`department`; System Admin has neither); `username` is present but the response makes no claim of writability (FR-001 thru FR-003, quickstart Scenario 1)

**Checkpoint**: Every role can view their own correctly-shaped profile — the feature's simplest, foundational piece.

---

## Phase 4: User Story 2 - Edit My Profile (Priority: P1)

**Goal**: Any user updates their own Email; a Student additionally updates Department (scoped to their own Company); Name/Username/Category are never writable regardless of request body content; a failed validation saves nothing.

**Independent Test**: Valid email update persists; invalid email format is rejected with zero partial save; a Student's department update to a different Company's department is rejected; a `name`/`username`/`category` field in the request body has no effect even if present.

- [x] T005 [P] [US2] `ProfileUpdateDto` (`email?` [`@IsEmail()`], `department_id?` [uuid]) in `api/src/profile/dto/profile-update.dto.ts` — deliberately has no `name`/`username`/`category_id` fields at all, so `class-validator`'s whitelist/forbid-non-whitelisted behavior (already the project convention per `coding_standard.md`) silently strips or rejects any such field in the raw body rather than needing explicit per-field ignore logic (FR-003, FR-005, FR-008)
- [x] T006 [US2] Implement `ProfileService.updateProfile(ctx, dto)` in `api/src/profile/profile.service.ts`: if `dto.department_id` is present, reject with `400` unless `ctx.role === 'student'` and the id resolves to a department under `ctx.companyId` (research.md §3 — identical rejection whether the id doesn't exist at all or belongs to a different company); validate `email` format (already enforced by the DTO, but confirm the whole update is atomic — a single `UPDATE` statement, not two separate writes) so a mid-update failure can never leave a partial change (FR-004, FR-005, FR-006, FR-007)
- [x] T007 [US2] `ProfileController`: `PATCH /me/profile` per contracts/openapi.yaml
- [ ] T008 [P] [US2] Contract tests in `api/test/contract/profile/edit.spec.ts`: valid email persists; invalid email format → `400`, a follow-up `GET` shows the old email unchanged (FR-006, FR-007); a Student's department update to another Company's department → `400`, rejected identically to a nonexistent id; a valid same-company department update → `200`; a `name`/`username`/`category_id` field included in the request body has zero effect on a follow-up `GET` (FR-003, FR-005, FR-008, SC-002, SC-003, quickstart Scenario 2)

**Checkpoint**: Profile editing works with the correct field boundaries enforced server-side, not just hidden client-side.

---

## Phase 5: User Story 3 - Change My Password (Priority: P1)

**Goal**: A logged-in user changes their password by confirming the current one; a mismatched new/retype is rejected before the current password is even checked; a wrong current password changes nothing; success revokes every other session except (optionally) the one that performed the change.

**Independent Test**: Correct current password + matching new/retype → password updates, a login with the new password succeeds, other sessions are revoked while the identified one (if any) survives.

- [x] T009 [P] [US3] `ChangePasswordDto` (`current_password`, `new_password`, `retype_password`, optional `refresh_token`) in `api/src/profile/dto/change-password.dto.ts`
- [x] T010 [US3] Implement `ProfileService.changePassword(ctx, dto)` in `api/src/profile/profile.service.ts`: reject with `400` immediately if `new_password !== retype_password`, **before** any current-password check (FR-010); otherwise verify `current_password` against the stored hash — on mismatch, write a `password_change_failed` audit event and reject with `401`, changing nothing (FR-011); on match, rehash and save `new_password`, write `password_change_succeeded`, then call `002`'s `AuthService.revokeAllSessions(ctx.userId, dto.refresh_token ? <that token's id, if it resolves to one of the caller's own active sessions> : undefined)` (FR-009, FR-012, research.md §2) — if `dto.refresh_token` doesn't resolve to an active session for this caller, treat it the same as omitted (revoke everything) rather than erroring, since it's an optional convenience parameter, not a required identifier
- [x] T011 [US3] `ProfileController`: `POST /me/change-password` per contracts/openapi.yaml (`200`/`400`/`401`)
- [ ] T012 [P] [US3] Contract tests in `api/test/contract/profile/change-password.spec.ts`: mismatched new/retype → `400`, and confirm (e.g. via a spy/mock on the password-verify call) the current-password check was never reached (FR-010); wrong current password → `401`, a subsequent login with the *old* password still succeeds (FR-011); correct current password + `refresh_token` set to the acting session's own token → `200`, that session's `POST /auth/refresh` still works afterward while a second, different session's refresh token now returns `401` (FR-012, quickstart Scenario 3)

**Checkpoint**: All three user stories independently pass — quickstart.md Scenarios 1–3 should now all pass.

---

## Phase 6: Mobile

- [x] T013 Split today's single `mobile/src/screens/student/ProfileScreen.tsx` stub into three real screens per UI Design §4.10–§4.12: `Profile.tsx` (view — detail card showing role-appropriate fields from `GET /me/profile`, an Edit button, a Change Password link, and the existing Logout action from `002`), `EditProfile.tsx` (Email + Department, the latter only rendered/editable for a Student — sourced from `PATCH /me/profile`), `ChangePassword.tsx` (Current/New/Retype fields with a client-side match check before submit, calling `POST /me/change-password` and passing the client's own stored refresh token so its own session survives)
- [x] T014 Wire navigation from `Profile.tsx` to `EditProfile.tsx` and `ChangePassword.tsx`, and confirm every role's navigation stack (Student, Company Admin/Staff, System Admin — check `mobile/src/screens/system-admin/` and `mobile/src/screens/tenant-admin-staff/` for whether a Profile entry point already exists for those roles, adding one if not) reaches the same shared Profile screen rather than a Student-only one, per this feature's explicit all-roles scope

---

## Phase 7: Polish

- [ ] T015 [P] Add `GET/PATCH /me/profile` and `POST /me/change-password` requests to `api/postman/GenzFeast-API.postman_collection.json`
- [ ] T016 Run every scenario in `specs/007-user-profile-management/quickstart.md` end-to-end against a local run of the API; fix any drift found

---

## Dependencies & Execution Order

- **Foundational (Phase 2)**: blocks every user story (module scaffolding only — no schema phase in this feature).
- **US1 (Phase 3)**: needs Phase 2 only. Independently testable — the MVP entry point.
- **US2 (Phase 4)**: needs Phase 2; independent of US1/US3 beyond sharing `ProfileService`.
- **US3 (Phase 5)**: needs Phase 2 + `002`'s `revokeAllSessions(userId, exceptRefreshTokenId?)` helper (already built per `002`'s tasks.md T023) — the one real external dependency in this feature.
- **Mobile (Phase 6)**: needs US1/US2/US3's endpoints live.
- **Polish (Phase 7)**: after all desired stories are done.

### Parallel Opportunities

- Within each user story phase, `[P]`-marked DTOs/tests run in parallel once that phase's core implementation task is done.
- US1, US2, and US3's implementation tasks (T002, T006, T010) can be built in parallel by different people once Phase 2 is done, since they touch different endpoints on the same small service file — coordinate on `profile.service.ts` merge order if done concurrently.

## Implementation Strategy

**MVP first**: Phase 2 → Phase 3 (US1, view) is enough to demonstrate the feature's simplest, foundational piece.

**Incremental delivery**: add Phase 4 (US2, edit) and Phase 5 (US3, change password) next — both are independent of each other and can proceed in either order or in parallel — then Phase 6 (mobile, including the all-roles navigation check in T014), then Phase 7 (polish).
