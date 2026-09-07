# Tasks: Company Admin Product Management

**Input**: Design documents from `/specs/004-company-admin-product-crud/` (spec.md, plan.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md)

**Tests**: Included — `plan.md`'s Testing section commits to Jest + Supertest contract tests plus a dedicated RLS test proving no `system_admin` bypass exists.

**Organization**: Tasks are grouped by user story (spec.md priorities P1/P1/P2/P2), then Mobile, then Polish. This spec had no open ambiguities during planning (plan.md notes one drafting inconsistency — an implied System Admin cross-tenant bypass — was already caught and corrected in `spec.md`/`data-model.md` before this task list was written).

## Pre-existing foundation (from `001`/`002`, reused as-is)

- `JwtAuthGuard`, `RolesGuard` + `@Roles(...)`, `TenantContextInterceptor` + `@CurrentTenantContext()`, and `TenantPrismaService.runInTenantContext()` are all already built (`api/src/common/`) — every task below wires into these, none re-implements them. Follow `api/src/companies/companies.controller.ts`'s existing shape (`@Controller` + `@UseGuards(JwtAuthGuard, RolesGuard)` + `@UseInterceptors(TenantContextInterceptor)` + `@Roles(...)`) as the template for `ProductsController`.
- No Supabase Storage client dependency exists yet in `api/package.json` — this feature is the first file-upload case in the codebase (research.md §1).
- Mobile placeholders already exist: `mobile/src/screens/tenant-admin-staff/ProductListScreen.tsx` (serves both the Company Admin full view and the Staff read/toggle-only view per UI Design §5.2/§5.5) and `ProductCreateEditScreen.tsx` (§5.3) — both currently stubs with a single placeholder button.

## Phase 1: Setup

- [x] T001 Add a Supabase Storage client dependency (`@supabase/supabase-js`) to `api/package.json`, and a `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (or bucket-scoped equivalent) entry to the env schema in `api/src/common/config/env.validation.ts` + `api/.env.example` (research.md §1)

---

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T002 Add `Product` model to `api/prisma/schema.prisma` per data-model.md §1 (fields, `CHECK (price > 0)`, FKs to `Company`/`User`)
- [x] T003 Write the Prisma migration in `api/prisma/migrations/<timestamp>_products/migration.sql` adding the `products` table with the `CHECK (price > 0)` constraint and the two RLS policies from data-model.md (`tenant_isolation_select`, `tenant_isolation_write`) — deliberately **no** `system_admin` bypass predicate (research.md §2)
- [x] T004 [P] Implement `ProductImageService` in `api/src/products/product-image.service.ts` — uploads a multipart image to Supabase Storage, returns the resulting `image_url` (research.md §1); pure storage-client wrapper, no DB access
- [x] T005 Create `ProductsModule` in `api/src/products/products.module.ts` wiring `ProductsService`/`ProductImageService`; register in `api/src/app.module.ts`

**Checkpoint**: Schema migrated, storage upload seam exists — user story work can begin.

---

## Phase 3: User Story 1 - Company Admin Adds a New Product (Priority: P1) 🎯 MVP

**Goal**: A Company Admin creates a product scoped to their own Company; validation rejects bad input; cross-tenant visibility is impossible by construction (RLS).

**Independent Test**: Submit a valid product → appears in that Company's list as available; submit with missing Name/Price or Price ≤ 0 → rejected, nothing created; a different Company's admin never sees it.

- [x] T006 [P] [US1] `CreateProductDto` (`name`, `description`, `price` [`@Min(1)`], `is_veg`, optional `is_soldout`) in `api/src/products/dto/create-product.dto.ts` (FR-001, FR-004, FR-005)
- [x] T007 [US1] Implement `ProductsService.create(ctx, dto)` in `api/src/products/products.service.ts` — inserts via `TenantPrismaService.runInTenantContext`, `company_id` from `ctx` only (never client-supplied), defaults `is_soldout: false` unless explicitly set (FR-005)
- [x] T008 [US1] Implement `ProductsService.list(ctx)` — returns the caller's company's active (`is_deleted = false`) products (FR-010)
- [x] T009 [US1] `ProductsController`: `GET /tenant/products` and `POST /tenant/products` in `api/src/products/products.controller.ts`, `@Roles('company_admin')` on create, `@Roles('company_admin', 'staff')` on list (Staff needs read access for its own toggle view, UI Design §5.5) per contracts/openapi.yaml
- [ ] T010 [P] [US1] Contract tests in `api/test/contract/products/create.spec.ts`: valid create → `201`, `is_soldout: false`, `image_url: null`; missing name/price and `price <= 0` → `400`, nothing created; Company B's admin never sees Company A's product via `GET /tenant/products` (FR-001, FR-003, FR-004, SC-004)

**Checkpoint**: Products can be created and listed, correctly tenant-scoped — MVP core.

---

## Phase 4: User Story 2 - Company Admin Toggles a Product's Sold-Out Status (Priority: P1)

**Goal**: A dedicated, minimal write path flips `is_soldout` without touching any other field; also reachable by Staff.

**Independent Test**: Toggle on → only `is_soldout` changes; toggle off → same; Staff can call it, Staff cannot call full edit.

- [x] T011 [US2] Implement `ProductsService.setSoldOut(ctx, productId, isSoldOut)` in `api/src/products/products.service.ts` — updates only `is_soldout` (+ `updated_by`/`updated_at`); 404 (via the `NotFound` semantics in contracts/openapi.yaml) if the product doesn't exist, belongs to a different company, or is soft-deleted (FR-006, FR-009)
- [x] T012 [US2] `ProductsController`: `PATCH /tenant/products/:productId/soldout`, `@Roles('company_admin', 'staff')` (FR-012)
- [ ] T013 [P] [US2] Contract tests in `api/test/contract/products/soldout.spec.ts`: toggle on/off changes only `is_soldout`, all other fields byte-identical to before (FR-006); a Staff caller succeeds at this endpoint but gets `403` on `PATCH /tenant/products/:id` (full edit) (FR-012, quickstart Scenario 3)

**Checkpoint**: Sold-out toggle independently verified for both roles — the two P1 stories (US1+US2) are the feature's MVP.

---

## Phase 5: User Story 3 - Company Admin Edits an Existing Product (Priority: P2)

**Goal**: Partial updates change only the submitted fields; invalid updates change nothing.

**Independent Test**: Update just `price` → only price changes; invalid update (e.g. `price: 0`) → rejected, stored data unchanged.

- [x] T014 [P] [US3] `UpdateProductDto` (all fields optional: `name`, `description`, `price` [`@Min(1)`], `is_veg`) in `api/src/products/dto/update-product.dto.ts` (FR-007)
- [x] T015 [US3] Implement `ProductsService.update(ctx, productId, dto)` — applies only the fields present in `dto`, leaving the rest untouched; rejects with no partial write if validation fails (e.g. `price <= 0`); 404 semantics same as T011 for a removed/foreign/missing product (FR-007, FR-009)
- [x] T016 [US3] `ProductsController`: `PATCH /tenant/products/:productId`, `@Roles('company_admin')` only
- [ ] T017 [P] [US3] Contract tests in `api/test/contract/products/update.spec.ts`: updating only `price` leaves every other field unchanged; an invalid update is rejected and a follow-up `GET` confirms zero partial change occurred (FR-007, quickstart Scenario 4)

**Checkpoint**: Full edit works independently of create/toggle.

---

## Phase 6: User Story 4 - Company Admin Removes a Product from the Menu (Priority: P2)

**Goal**: Soft-delete excludes a product from the active list/student browsing while preserving the row and any existing references to it; a removed product can't be further mutated via the normal flow.

**Independent Test**: Remove a product → gone from the active list; further edit/toggle/remove on it → rejected (404-equivalent), not silently no-op'd.

- [x] T018 [US4] Implement `ProductsService.remove(ctx, productId)` — sets `is_deleted = true` (+ `updated_by`/`updated_at`); never a hard delete (FR-008); ensure `update`/`setSoldOut`/`remove` all treat an already-`is_deleted` row identically to "not found" (FR-009)
- [x] T019 [US4] `ProductsController`: `DELETE /tenant/products/:productId`, `@Roles('company_admin')` only, `204` on success
- [ ] T020 [P] [US4] Contract tests in `api/test/contract/products/remove.spec.ts`: removed product disappears from `GET /tenant/products`; a subsequent `PATCH .../soldout` or `PATCH /tenant/products/:id` on it both return the not-found response; the underlying row still exists in the DB (query directly, bypassing the active-list filter) (FR-008, FR-009, SC-003, quickstart Scenario 5)

**Checkpoint**: All four user stories independently pass — quickstart.md Scenarios 1–5 should now all pass.

---

## Phase 7: Photo Upload (cross-cutting on US1/US3)

- [x] T021 Implement `ProductsService.setImage(ctx, productId, file)` in `api/src/products/products.service.ts` — delegates to `ProductImageService.upload` (T004), stores the returned `image_url` on the product row (FR-002)
- [x] T022 `ProductsController`: `POST /tenant/products/:productId/image` (`multipart/form-data`), `@Roles('company_admin')` only, per contracts/openapi.yaml
- [ ] T023 [P] Contract test in `api/test/contract/products/image.spec.ts`: uploading an image on an existing product returns a retrievable `image_url`; image upload on a nonexistent/foreign/removed product returns the not-found response (FR-002)

---

## Phase 8: RLS & Security

- [ ] T024 [P] Dedicated RLS test in `api/test/rls/products-no-admin-bypass.spec.ts` proving `system_admin`'s session context gets **zero** rows from another company's `products` table — a direct, explicit test of the deliberate absence noted in research.md §2 and data-model.md, not just an inference from the migration SQL

---

## Phase 9: Mobile (Company Admin + Staff surfaces, `tenant-admin-staff`)

- [x] T025 Wire `mobile/src/screens/tenant-admin-staff/ProductListScreen.tsx` to `GET /tenant/products` (UI Design §5.2): image thumbnail, name, price, veg/non-veg icon, sold-out toggle switch (calling `PATCH .../soldout` directly from the list — SC-002's "two taps or fewer"), edit icon → `ProductCreateEdit`, `+ Add Product` FAB — render for both Company Admin (full actions) and Staff (toggle-only, per §5.5 — hide/disable edit and the FAB when `role === 'staff'`)
- [x] T026 Wire `mobile/src/screens/tenant-admin-staff/ProductCreateEditScreen.tsx` to `POST /tenant/products` (create) and `PATCH /tenant/products/:id` (edit) per UI Design §5.3 (Name, Description, Image, Price, Is Veg fields), plus `POST /tenant/products/:id/image` for photo upload; client-side field validation mirroring FR-004 before submit
- [x] T027 Add a remove/delete action (e.g. swipe-to-delete or a menu item) on `ProductListScreen.tsx` calling `DELETE /tenant/products/:id`, Company-Admin-only (hidden for Staff)

---

## Phase 10: Polish

- [ ] T028 [P] Add the five `/tenant/products*` requests to `api/postman/GenzFeast-API.postman_collection.json`
- [ ] T029 Run every scenario in `specs/004-company-admin-product-crud/quickstart.md` end-to-end against a local run of the API; fix any drift found

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)**: blocks every user story.
- **US1 (Phase 3)**: needs Phase 2 only. Independently testable — the MVP entry point.
- **US2 (Phase 4)**: needs Phase 2 + a product to toggle (US1's create), but its own write path is independent of US3/US4.
- **US3 (Phase 5)**: independent of US2/US4 beyond needing a product to edit (US1).
- **US4 (Phase 6)**: needs T011/T015's not-found-on-removed semantics to be consistent — sequence after US2/US3, or implement the shared "not found if removed" check once and reuse it across T011/T015/T018.
- **Photo Upload (Phase 7)**: needs Phase 2 (T004) + US1's create endpoint to have a product to attach a photo to.
- **RLS (Phase 8)**: needs Phase 2's migration; can run any time after.
- **Mobile (Phase 9)**: needs the corresponding backend endpoints live.
- **Polish (Phase 10)**: after all desired stories are done.

### Parallel Opportunities

- Phase 2: T004 can run alongside T002/T003.
- Within each user story phase, `[P]`-marked DTOs and contract tests run in parallel once their phase's core implementation task is done.
- Phase 10: T028 in parallel with T029.

## Implementation Strategy

**MVP first**: Phase 1 → Phase 2 → Phase 3 (US1, create+list) → Phase 4 (US2, sold-out toggle) — the two P1 stories give a canteen a working, stockable menu.

**Incremental delivery**: add Phase 5 (US3, full edit) and Phase 6 (US4, removal) next, Phase 7 (photo upload) alongside or right after US1 since it's low-risk and additive, Phase 8 (the explicit RLS-bypass-absence test) at any point once the migration exists, then Phase 9 (mobile) once the corresponding endpoints are live, then Phase 10 (polish).
