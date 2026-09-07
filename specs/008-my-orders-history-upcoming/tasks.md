# Tasks: My Orders — History & Upcoming Orders

**Input**: Design documents from `/specs/008-my-orders-history-upcoming/` (spec.md, plan.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md)

**Tests**: Included — `plan.md`'s Testing section commits to extending `006`'s existing `student-orders` contract tests with view-filter correctness and per-status `OrderDetail` shape cases.

**Organization**: Tasks are grouped by user story (spec.md priorities P1×3), then Mobile, then Polish. No spec ambiguity was found during task planning — like `007`, this feature needs **no new table, migration, or RLS policy**; it is purely a query-filter and response-field extension of `006`'s existing `GET /student/orders`/`GET /student/orders/:id`.

## Dependency (read first)

This feature extends `006-student-browse-cart-checkout`'s existing `student-orders` module — it does not create a new one. `006` must already expose `GET /student/orders` and `GET /student/orders/:orderId` (its `student-orders.controller.ts`/`.service.ts`) for this feature's tasks to have something to extend. If `006` hasn't landed yet, treat T002/T003/T005 below as edits to make once it has, not new files to create from scratch.

## Pre-existing foundation (reused, not re-built)

- `006`'s `orders` table, its `student_own_orders`/`student_create_own_orders` RLS policies, and its existing `StudentOrdersService`/`StudentOrdersController` — this feature adds a query parameter and a response field to what's already there, per plan.md's explicit "no new module" decision.
- Mobile: `mobile/src/screens/student/MyOrdersScreen.tsx` already has real UI structure (card list with `StatusBadge`, navigation to `OrderDetail`) against `MOCK_ORDERS` covering all four statuses — no tab split yet. `OrderDetailScreen.tsx` is a bare stub already documented (per its own comment) as shared across specs 006/008/010 for status-specific content.

## Phase 1: Setup

- [ ] None — no new dependency, env var, or config.

---

## Phase 2: Foundational

- [ ] None — no schema/migration/module-scaffolding phase; this feature only modifies existing `006` files (see Dependency note above).

---

## Phase 3: User Story 1 - View Upcoming Orders (Priority: P1) 🎯 MVP

**Goal**: `GET /student/orders?view=upcoming` returns only the caller's own `payment_pending`/`order_placed` orders, most-recent-first.

**Independent Test**: A student with one order in each of the four statuses gets back exactly the two unresolved ones when requesting the upcoming view.

- [x] T001 [US1] Extend `StudentOrdersService.listOrders(ctx, view?)` in `api/src/student-orders/student-orders.service.ts` (from `006`) — accept an optional `view: 'upcoming' | 'history'`; when `'upcoming'`, add `status IN ('payment_pending', 'order_placed')` to the existing ownership-scoped query and `ORDER BY created_at DESC`; omitting `view` MUST preserve `006`'s original unfiltered behavior exactly (research.md §1, plan.md's additive constraint) (FR-001, FR-002, FR-005)
- [x] T002 [US1] Extend `StudentOrdersController`'s `GET /student/orders` in `api/src/student-orders/student-orders.controller.ts` to accept and forward the optional `view` query parameter per contracts/openapi.yaml
- [ ] T003 [P] [US1] Contract tests in `api/test/contract/student-orders/my-orders-views.spec.ts` (extending `006`'s existing suite): `view=upcoming` against a student with orders in all four statuses returns exactly the `payment_pending`/`order_placed` ones, most-recently-placed first; omitting `view` still returns every order unfiltered, unchanged from `006`'s original behavior (FR-001, FR-002, FR-005, quickstart Scenario 1)

**Checkpoint**: Upcoming view works — the feature's most-frequently-used piece.

---

## Phase 4: User Story 2 - View Order History (Priority: P1)

**Goal**: `GET /student/orders?view=history` returns only `delivered`/`payment_failed`/(unreachable) `cancelled` orders, most-recent-first.

**Independent Test**: The same four-status student gets back exactly the `delivered` and `payment_failed` orders when requesting the history view.

- [x] T004 [US2] Extend T001's filter logic to handle `view: 'history'` → `status IN ('delivered', 'payment_failed', 'cancelled')` (the `'cancelled'` literal is deliberately included for schema completeness per research.md §4, even though no V1 flow ever produces it) — same file, same method, added as the other branch of the `view` switch (FR-003, FR-005)
- [ ] T005 [P] [US2] Contract tests in `api/test/contract/student-orders/my-orders-views.spec.ts` (same file as T003): `view=history` returns exactly the `delivered`/`payment_failed` orders, most-recently-placed first, never the two unresolved ones (FR-003, FR-005, quickstart Scenario 2)

**Checkpoint**: Both views work independently — together, User Stories 1+2 give a student the complete order-activity picture.

---

## Phase 5: User Story 3 - View an Order's Status-Appropriate Detail (Priority: P1)

**Goal**: An order's detail response includes `delivered_at`, so the client can derive exactly the right status-specific content (pickup code / delivered time / Pay Again) from `status` alone.

**Independent Test**: The detail response for each of the four statuses shows exactly the fields appropriate to that status — `otp` only for `order_placed`, `delivered_at` only for `delivered`, neither for `payment_pending`/`payment_failed`.

- [x] T006 [US3] Extend `StudentOrdersService.getOrder(ctx, orderId)` in `api/src/student-orders/student-orders.service.ts` (from `006`) to include `delivered_at` in the returned `OrderDetail` shape — the column already exists (owned by `005`/`006`); no new field needed to signal "show Pay Again," since the client derives that from `status === 'payment_failed'` alone (research.md §3) (FR-006, FR-007, FR-008, FR-009)
- [ ] T007 [P] [US3] Contract tests in `api/test/contract/student-orders/order-detail-status-shape.spec.ts`: for each of the four reachable statuses, assert the exact expected shape — `order_placed` → `otp` populated, `delivered_at: null`; `delivered` → `delivered_at` populated, `otp: null`; `payment_failed` → both `null`; `payment_pending` → both `null`; a different student's request for the same order id still returns `404` (unchanged from `006`) (FR-006 thru FR-010, quickstart Scenario 3-4)

**Checkpoint**: All three user stories independently pass — quickstart.md Scenarios 1–4 should now all pass.

---

## Phase 6: Mobile

- [x] T008 Add Upcoming/History tabs to `mobile/src/screens/student/MyOrdersScreen.tsx` per UI Design §4.13, wiring each tab to `GET /student/orders?view=upcoming` / `?view=history` respectively (replacing `MOCK_ORDERS`) — keep the existing card layout (`StatusBadge`, reference/items-summary/total, tap-to-navigate) unchanged, since it already matches the target shape
- [x] T009 Extend `mobile/src/screens/student/OrderDetailScreen.tsx` (already shared across specs 006/008/010 per its own comment) to render the status-conditional content this feature completes: pickup code (`order_placed`), delivered time (`delivered`), Pay Again action (`payment_failed`, wired to `006`'s retry-payment endpoint) — no extra content for `payment_pending`

---

## Phase 7: Polish

- [ ] T010 [P] Update the `GET /student/orders` entry in `api/postman/GenzFeast-API.postman_collection.json` (from `006`) to document the new `view` query parameter
- [ ] T011 Run every scenario in `specs/008-my-orders-history-upcoming/quickstart.md` end-to-end against a local run of the API; fix any drift found

---

## Dependencies & Execution Order

- **US1 (Phase 3)** and **US2 (Phase 4)** both extend the same `listOrders` method (T001/T004) — implement them together in one pass rather than strictly sequentially, since splitting the `view` switch's two branches across separate PRs would be artificial.
- **US3 (Phase 5)**: independent of US1/US2 — touches `getOrder`, not `listOrders`. Can be built in parallel.
- **Mobile (Phase 6)**: needs US1/US2 (T008) and US3 (T009) endpoints live.
- **Polish (Phase 7)**: after all desired stories are done.

### Parallel Opportunities

- T001+T004 (list filtering) and T006 (detail extension) touch different methods in the same file — can be developed in parallel and merged together.
- `[P]`-marked contract tests run in parallel once their corresponding implementation task is done.
- Phase 7: T010 in parallel with T011.

## Implementation Strategy

**MVP first**: T001+T002 (Upcoming) + T004 (History) together — both are trivial extensions of the same filter switch, so there's little reason to ship one without the other. Add T006 (detail completion) alongside, since all three P1 stories here are small enough to deliver as one unit rather than staged increments.

**Incremental delivery**: Mobile (Phase 6) once the endpoints are live, then Polish (Phase 7).
