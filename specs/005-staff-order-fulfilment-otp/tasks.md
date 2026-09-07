# Tasks: Staff Order Fulfilment (Incoming Orders & OTP Verification)

**Input**: Design documents from `/specs/005-staff-order-fulfilment-otp/` (spec.md, plan.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md)

**Tests**: Included — `plan.md`'s Testing section commits to Jest + Supertest contract tests, seeding `orders` fixtures directly since Checkout & Payment doesn't exist yet.

**Organization**: Tasks are grouped by user story (spec.md priorities P1/P1/P2), then Mobile, then Polish. This spec had one small documentation gap found during task planning (the `reference` field appeared in `contracts/openapi.yaml` but not in `data-model.md`'s `orders` consumer contract) — already reconciled in `data-model.md` directly (derived from `id`, not a required stored column) before this task list was written.

## Dependency: the `orders` table does not exist yet (read before starting)

This feature is a **consumer** of an `orders` table it does not create — that table belongs to the not-yet-built `006-student-browse-cart-checkout` (Checkout & Payment). `data-model.md`'s "Dependency: `orders`" section is the exact consumer contract (columns + required behavior) that feature must satisfy. Until `006` exists:
- All contract tests seed `orders` rows directly via a test fixture (`api/test/fixtures/orders.ts`), never through a real checkout flow.
- Implement against the contract as documented; if `006` ends up shaping `orders` differently, this feature's queries/DTOs may need a small follow-up adjustment — flag that explicitly in this feature's PR description rather than silently guessing ahead of `006`'s own spec.

## Phase 1: Setup

- [ ] T001 Create `api/test/fixtures/orders.ts` — a test-only helper that inserts `orders` rows directly (bypassing RLS via a system-actor context, matching `002`'s pattern) in each state this feature needs: `order_placed` (with a known plaintext pickup code), `payment_pending`, and `delivered`, per data-model.md's consumer contract

---

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T002 Add `Delivery` and `OrderAuditLog` models to `api/prisma/schema.prisma` per data-model.md §1–2 (FKs to a manually-declared `Order` reference — see note below)
- [x] T003 Write the Prisma migration in `api/prisma/migrations/<timestamp>_staff_order_fulfilment/migration.sql` adding `deliveries` (`UNIQUE (order_id)`, FR-008) and `order_audit_logs`, both RLS-enabled with the tenant-isolation policy from data-model.md — **no `system_admin` bypass**, consistent with `004`'s precedent
- [x] T004 Create `StaffOrdersModule` in `api/src/staff-orders/staff-orders.module.ts`; register in `api/src/app.module.ts`

**Note on T002**: Since `orders` isn't migrated by this feature, `Delivery`/`OrderAuditLog`'s `order_id` FK either (a) references a minimal placeholder `Order` model added to `schema.prisma` now (columns per the consumer contract only, no ownership implied — `006` will extend it) so Prisma's relations/types work, or (b) is left as a plain `uuid` column with the FK constraint added at the SQL level once `006` migrates the real table. Prefer (a) for type-safety in `staff-orders.service.ts`; make sure `006`'s eventual migration doesn't conflict (coordinate via that feature's PR review).

**Checkpoint**: Schema in place — user story work can begin, tested entirely against fixtures.

---

## Phase 3: User Story 1 - Staff Views Incoming Orders (Priority: P1) 🎯 MVP

**Goal**: Staff sees only their own Company's `order_placed` orders, with enough summary detail to act, and can open one for full detail.

**Independent Test**: A seeded `order_placed` fixture appears in Company A Staff's list; a `payment_pending`/`delivered` fixture does not; Company B's Staff never sees Company A's order.

- [x] T005 [US1] Implement `StaffOrdersService.listIncoming(ctx)` in `api/src/staff-orders/staff-orders.service.ts` — queries `orders` where `company_id = ctx.companyId AND status = 'order_placed'` via `TenantPrismaService`, maps to `OrderSummary` (id, derived `reference`, `item_count`, `total_amount`, `placed_at`) — never selects the `otp` column into this response shape (FR-001, FR-002, FR-009, FR-010)
- [x] T006 [US1] Implement `StaffOrdersService.getDetail(ctx, orderId)` — same tenant-scoped lookup, restricted to `status = 'order_placed'` (a delivered/foreign/nonexistent order is "not found" per contracts/openapi.yaml), maps to `OrderDetail` (full item breakdown + total) — again never including `otp` (FR-004, FR-009)
- [x] T007 [US1] `StaffOrdersController`: `GET /tenant/staff/orders` and `GET /tenant/staff/orders/:orderId` in `api/src/staff-orders/staff-orders.controller.ts`, `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('staff')` per contracts/openapi.yaml
- [ ] T008 [P] [US1] Contract tests in `api/test/contract/staff-orders/list-and-detail.spec.ts` using T001's fixtures: `order_placed` fixture appears in the list, `payment_pending`/`delivered` fixtures don't; Company B's Staff gets an empty/other-company-only list; detail response for the `order_placed` fixture never contains the pickup code anywhere in the body (assert on the raw JSON, not just the typed schema) (FR-001 thru FR-004, FR-009, FR-010, SC-005, SC-006)

**Checkpoint**: Staff can see and inspect their incoming orders, correctly tenant- and status-scoped.

---

## Phase 4: User Story 2 - Staff Verifies the Pickup OTP and Completes Delivery (Priority: P1)

**Goal**: A matching code transitions the order to `delivered`, creates exactly one `deliveries` row, and can never re-trigger delivery afterward.

**Independent Test**: Submit the fixture's known correct code → `200`, delivered, one `deliveries` row; submit that same code again → `409`, no second row.

- [x] T009 [US2] Implement `StaffOrdersService.verify(ctx, orderId, code)` in `api/src/staff-orders/staff-orders.service.ts`: look up the `order_placed` order for `ctx.companyId`; if not found (wrong company, nonexistent, or already `delivered`) → the `404`/`409` distinction per contracts/openapi.yaml (already-delivered is `409`, truly-not-found is `404`); compare `code` against the stored plaintext `otp` (research.md §2 — never hashed, since the student must be able to re-view it); on match — in one transaction: set `status = 'delivered'`, `delivered_at = now()`, insert one `deliveries` row (`delivered_by = ctx.userId`), write `order_delivered` + `pickup_verification_succeeded` to `order_audit_logs` (FR-006, FR-008, FR-011); on mismatch — write `pickup_verification_failed` only, no other change (FR-007, FR-012 — no attempt counter, no lockout)
- [x] T010 [US2] `StaffOrdersController`: `POST /tenant/staff/orders/:orderId/verify` per contracts/openapi.yaml (`200`/`404`/`409`/`422`)
- [ ] T011 [P] [US2] Contract tests in `api/test/contract/staff-orders/verify.spec.ts`: correct code → `200`, `deliveries` has exactly one row for that `order_id` with the correct `delivered_by`, `order_audit_logs` has the success event(s); the now-delivered order disappears from the incoming list (FR-010); resubmitting the same code on the same order → `409`, still exactly one `deliveries` row (FR-008, SC-003)

**Checkpoint**: End-to-end fulfilment (view → verify → deliver) works — this is the feature's MVP together with US1.

---

## Phase 5: User Story 3 - Staff Retries After a Mismatched Code (Priority: P2)

**Goal**: A wrong code changes nothing and can be immediately retried; there is no attempt limit.

**Independent Test**: Wrong code → `422`, order still `order_placed`; correct code right after → succeeds normally; 10 consecutive wrong codes still allow an 11th, correct one to succeed.

- [ ] T012 [P] [US3] Contract tests in `api/test/contract/staff-orders/mismatch-and-retry.spec.ts`: a wrong code returns `422` with the order's status unchanged (verified via a follow-up `GET`) and a `pickup_verification_failed` audit row written; the correct code immediately afterward succeeds normally, unaffected by the prior mismatch (FR-007, quickstart Scenario 3)
- [ ] T013 [P] [US3] Contract test in `api/test/contract/staff-orders/no-attempt-limit.spec.ts`: 10 consecutive incorrect submissions against the same order all return `422` with no lockout/throttling response, and the correct code still succeeds immediately after (FR-012, quickstart Scenario 4)

**Checkpoint**: All three user stories independently pass — quickstart.md Scenarios 1–4 should now all pass.

---

## Phase 6: Mobile (Staff surface)

- [x] T014 Wire `mobile/src/screens/tenant-admin-staff/IncomingOrdersScreen.tsx` to `GET /tenant/staff/orders` (UI Design §5.6): list showing order reference, item count, total, time placed; tapping a row navigates to `OrderFulfilment` with the real `orderId` (replacing today's `'placeholder'` navigation param)
- [x] T015 Wire `mobile/src/screens/tenant-admin-staff/OrderFulfilmentScreen.tsx` to `GET /tenant/staff/orders/:orderId` (item/total detail) and `POST /tenant/staff/orders/:orderId/verify` (UI Design §5.7): OTP input + "Verify & Deliver" button; on `200` show delivered confirmation and navigate back to (now-updated) Incoming Orders; on `422` show an inline mismatch error and allow immediate retry without leaving the screen; on `409` show an already-delivered message
- [x] T016 Ensure `IncomingOrdersScreen` reflects a newly delivered order's disappearance and a newly placed order's appearance through normal app use (SC-001, SC-006) — polling, pull-to-refresh, or refetch-on-focus is an acceptable implementation choice per spec.md Assumptions (no specific mechanism mandated)

---

## Phase 7: Polish

- [ ] T017 [P] Add the three `/tenant/staff/orders*` requests to `api/postman/GenzFeast-API.postman_collection.json`
- [ ] T018 Run every scenario in `specs/005-staff-order-fulfilment-otp/quickstart.md` end-to-end against a local run of the API (using the T001 fixtures); fix any drift found
- [ ] T019 Once `006-student-browse-cart-checkout` lands and migrates the real `orders` table, re-run this feature's full contract-test suite against it (not just fixtures) and reconcile any column/behavior drift from the consumer contract in data-model.md — flag and fix in a small follow-up PR

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)**: blocks every user story.
- **US1 (Phase 3)**: needs Phase 2 + T001's fixtures. Independently testable — the MVP entry point.
- **US2 (Phase 4)**: needs Phase 2 + T001, and conceptually builds on US1's lookup logic (T006) but has its own write path.
- **US3 (Phase 5)**: needs US2's verify logic (T009) in place; adds no new production code, only tests against it.
- **Mobile (Phase 6)**: needs US1 + US2's endpoints live.
- **Polish (Phase 7)**: after all desired stories are done; T019 is externally gated on `006`.

### Parallel Opportunities

- Within each user story phase, `[P]`-marked contract test files run in parallel once that phase's implementation task is done.
- Phase 7: T017 in parallel with T018.

## Implementation Strategy

**MVP first**: Phase 1 → Phase 2 → Phase 3 (US1, view) → Phase 4 (US2, verify+deliver) — the two P1 stories give Staff a working counter-fulfilment flow, tested entirely against fixtures pending `006`.

**Incremental delivery**: add Phase 5 (US3, mismatch/retry/no-limit hardening) next, then Phase 6 (mobile), then Phase 7 (polish, including the T019 reconciliation pass once `006` ships).
