# Tasks: Audit Trail for Product, Order & Payment Changes

**Input**: Design documents from `/specs/011-audit-logs-product-order-payment/` (spec.md, plan.md, research.md, data-model.md, quickstart.md — **no `contracts/`**: this feature exposes no HTTP interface at all, per plan.md's explicit note)

**Tests**: Included — `plan.md`'s Testing section commits to a SQL-level (or Jest-driving-real-transactions) suite exercising each of the three tables' create/update/soft-delete paths, plus a dedicated privilege test proving `UPDATE`/`DELETE` on `audit_logs` is impossible for the application's own DB role.

**Organization**: Tasks are grouped by user story (spec.md priorities P1×3/P2), then Polish. **There is no Mobile phase** — this feature has zero client-facing surface (no endpoint, no screen; spec.md Assumptions explicitly states no viewing/query UI is built here). No spec ambiguity was found during task planning.

## Dependencies (read first)

This feature attaches a trigger to three tables it does not create: `products` (`004-company-admin-product-crud`), `orders` (`006-student-browse-cart-checkout`), and `payment_attempts` (`010-resume-pending-order-payment`). None of these exist in `api/prisma/schema.prisma` yet as of this writing — only `001`'s `Company`/`Role`/`Category`/`Department`/`User` models exist. **This feature cannot be migrated until `004`, `006`, and `010` have all landed their own migrations.** Every task below assumes those three tables already exist with exactly the column names data-model.md references (`products.is_deleted`, `orders.status`, `payment_attempts.outcome`, etc.).

This feature also depends on `006`'s payment-webhook handler correctly setting `app.current_system_actor` before its writes (research.md §4) — `TenantPrismaService.runInTenantContext`'s `systemActor` field already exists in the codebase (`api/src/common/prisma/tenant-prisma.service.ts`) for exactly this purpose, but whether `006`'s webhook actually populates it with a specific, consistent value (e.g., `'payment_webhook'`) needs to be confirmed, not assumed — see T007.

## Phase 1: Setup

- [ ] None — no new dependency, env var, or config; this is pure SQL/PL-pgSQL added via migration.

---

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T001 Add an `AuditLog` model to `api/prisma/schema.prisma` per data-model.md §1 (`table_name`, `record_id`, nullable `company_id`, `action` enum, nullable `changed_fields` jsonb, nullable `performed_by_user_id`, nullable `performed_by_system`) — **no application-level `@relation` needing write access**, since this table is trigger-populated only, never written to by Prisma directly
- [x] T002 Write the Prisma migration in `api/prisma/migrations/<timestamp>_audit_logs/migration.sql` containing, in order: (a) the `audit_logs` table with its `CHECK ((performed_by_user_id IS NOT NULL) <> (performed_by_system IS NOT NULL))` constraint and `(table_name, record_id, created_at)` index (data-model.md §1); (b) `ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY` with **no** `SELECT` policy for any application role (research.md §6 — deny-by-default, no viewing feature exists yet); (c) `REVOKE UPDATE, DELETE ON audit_logs FROM <app_role>` (research.md §5 — the actual immutability guarantee, not just an absent endpoint)
- [x] T003 Write `fn_audit_log()` as a PL/pgSQL trigger function in the same migration (data-model.md §2, research.md §1-§4): determine `action` from `TG_OP`/`TG_TABLE_NAME` (`INSERT` → `created`; `UPDATE` where a `products` row's `is_deleted` transitions `false`/`NULL` → `true` → `removed`; every other `UPDATE` → `updated` — research.md §2); for `UPDATE`, diff `OLD`/`NEW` via `row_to_json`, excluding `created_at`/`updated_at`/`created_by`/`updated_by`, into `changed_fields` (research.md §3); resolve `company_id` directly from `NEW.company_id` for `products`/`orders`, or via a subquery against `orders` using `NEW.order_id` for `payment_attempts` (research.md §6); resolve the actor from `current_setting('app.current_user_id', true)` (→ `performed_by_user_id`) or, if that's empty, `current_setting('app.current_system_actor', true)` (→ `performed_by_system`) — fail the write (let the `CHECK` constraint reject it) if neither is set, per plan.md's explicit "fail loud" constraint; `INSERT` one `audit_logs` row
- [x] T004 In the same migration, attach the trigger: `CREATE TRIGGER audit_products AFTER INSERT OR UPDATE ON products FOR EACH ROW EXECUTE FUNCTION fn_audit_log();` and the equivalent for `orders` and `payment_attempts` (data-model.md §2)

**Checkpoint**: The generic mechanism exists and is attached to all three tables — every subsequent "user story" here is really a verification exercise against the same underlying trigger, not separate implementation work.

---

## Phase 3: User Story 1 - Every Product Change Is Automatically Recorded (Priority: P1) 🎯 MVP

**Goal**: Creating, editing, toggling sold-out, and removing a Product each produce exactly one correctly-shaped `audit_logs` row, with zero application code changes to `004`'s existing `products` module.

**Independent Test**: Exercise `004`'s four write endpoints in sequence and confirm four distinct, correctly-shaped audit rows, with the removal producing `action: 'removed'` (not `'updated'`) and prior history left intact.

- [ ] T005 [P] [US1] DB-level tests in `test/db/audit-log/products.spec.ts` (or Jest driving real transactions, per plan.md's Testing note): `POST /tenant/products` → one row, `action: 'created'`, `changed_fields: NULL`; `PATCH .../price` → one row, `action: 'updated'`, `changed_fields: {"price": {"old":..., "new":...}}`, no `updated_at` entry; `PATCH .../soldout` as **Staff** → one row, `action: 'updated'`, `changed_fields: {"is_soldout": ...}`, `performed_by_user_id` = the Staff user's id (confirms capture is role-agnostic, FR-001 Scenario 3); `DELETE` → one row, `action: 'removed'` (not `'updated'`), `changed_fields` includes `is_deleted: {old: false, new: true}`; a final query for this product's `record_id` shows all 4 rows still present and unchanged after the removal (FR-001, FR-004, FR-007, FR-008, SC-001, quickstart Scenario 1)

**Checkpoint**: The highest-value, most-exercised table's audit trail is proven correct — no application code in `004` needed to change at all.

---

## Phase 4: User Story 2 - Every Order Lifecycle Change Is Automatically Recorded (Priority: P1)

**Goal**: Order creation and every status transition are captured; a webhook-driven transition correctly names the automated process as the actor, never leaving it blank.

**Independent Test**: Place an order, then simulate a webhook confirmation, and confirm both produce audit rows — the second with `performed_by_system` populated, not null.

- [x] T006 [US2] Confirm/adjust `006`'s `StudentOrdersService.placeOrder` writes through a `TenantPrismaService` context carrying `userId: ctx.userId` (so `app.current_user_id` is set) — this should already be true by construction of `006`'s existing pattern; this task is a verification pass, not new code, unless a gap is found
- [x] T007 Confirm/wire `006`'s `PaymentsService.handleWebhook` (`api/src/payments/payments.service.ts`) to pass a consistent `systemActor` value (e.g., `'payment_webhook'`) into every `TenantPrismaService.runInTenantContext` call it makes for its `orders`/`payment_attempts` writes — per research.md §4, this is the one line plan.md calls out as this feature's only required application-code change; without it, the trigger has neither `app.current_user_id` nor `app.current_system_actor` set and the write fails loudly (by design) rather than producing a blank-actor audit row
- [ ] T008 [P] [US2] DB-level tests in `test/db/audit-log/orders.spec.ts`: placing an order → one `audit_logs` row, `table_name: 'orders'`, `action: 'created'`, `performed_by_user_id` = the ordering student; a simulated webhook success → one row, `action: 'updated'`, `changed_fields` includes `status: {"old": "payment_pending", "new": "order_placed"}` (and confirm `otp`'s new value is captured, since it's a business field, not excluded bookkeeping), `performed_by_system: 'payment_webhook'` — **never** null/blank (FR-002, FR-005, SC-002, SC-004, quickstart Scenario 2, User Story 2 Scenario 3)

**Checkpoint**: Order lifecycle changes are captured, and the platform's highest-volume automated writer (the webhook) is always correctly attributed.

---

## Phase 5: User Story 3 - Every Payment Attempt Change Is Automatically Recorded (Priority: P1)

**Goal**: A payment attempt's creation and its outcome resolution are both captured, with `company_id` correctly resolved via the owning order even though `payment_attempts` has no `company_id` column of its own.

**Independent Test**: Create a second attempt via `010`'s resume-payment flow, then resolve it, and confirm both produce correctly-scoped audit rows.

- [ ] T009 [P] [US3] DB-level tests in `test/db/audit-log/payment-attempts.spec.ts`: `010`'s resume-payment flow creating a new current attempt → one row, `table_name: 'payment_attempts'`, `action: 'created'`, `company_id` correctly resolved via the join to the owning order (research.md §6); that attempt resolving (success or failure) → one row, `action: 'updated'`, `changed_fields` includes `outcome` (FR-003, SC-003, quickstart Scenario 3)

**Checkpoint**: All three user stories independently pass — quickstart.md Scenarios 1-3 should now all pass.

---

## Phase 6: User Story 4 - Audit Records Are Complete and Cannot Be Altered (Priority: P2)

**Goal**: Prove immutability and actor-completeness as explicit, standalone guarantees, not just implied by the other three stories passing.

**Independent Test**: Attempt an `UPDATE`/`DELETE` against `audit_logs` using the application's own DB role and confirm both are rejected at the database layer; scan a sample of rows and confirm every one has exactly one actor field set.

- [ ] T010 [P] [US4] Dedicated privilege test in `test/db/audit-log/immutability.spec.ts`, run against the application's actual runtime DB role/connection (not a superuser/migration-time connection): `UPDATE audit_logs SET changed_fields = '{}' WHERE id = ...` → rejected with a permissions error; `DELETE FROM audit_logs WHERE id = ...` → rejected the same way (FR-006, SC-005, research.md §5, quickstart Scenario 4 steps 1-2)
- [ ] T011 [P] [US4] Extend T005/T008/T009's assertions (or add one consolidated check) confirming every row produced across all three tables' test scenarios has exactly one of `performed_by_user_id`/`performed_by_system` set — never both, never neither (FR-004, FR-005, SC-004, quickstart Scenario 4 step 3 — this is also mechanically enforced by the `CHECK` constraint from T002, so this test is verifying the constraint actually fires as expected, not just trusting it exists)

---

## Phase 7: Polish

- [ ] T012 Run every scenario in `specs/011-audit-logs-product-order-payment/quickstart.md` end-to-end against a local run of the API with direct DB read access for verification (this feature grants no application-role `SELECT` on `audit_logs`, so verification must go through a test/admin connection, never through any application endpoint); fix any drift found
- [x] T013 [P] Add a short note to `coding_standard.md` (or wherever the project records this kind of platform-wide convention) that any **new** write path added to `products`/`orders`/`payment_attempts` in the future must set `app.current_user_id` or `app.current_system_actor` before writing, or its write will fail — this is now a load-bearing convention for every future feature touching these three tables, not just this one

---

## Dependencies & Execution Order

- **Foundational (Phase 2)**: T001-T004 (the entire trigger mechanism) block every user story — and themselves depend on `004`/`006`/`010` already having migrated `products`/`orders`/`payment_attempts` (see "Dependencies" above).
- **US1 (Phase 3)**: needs Phase 2 only. Independently testable — the MVP entry point (Products are the most frequently mutated table).
- **US2 (Phase 4)**: needs Phase 2 + T007's webhook-actor confirmation/wiring — without it, this story's second assertion (webhook-driven changes are attributed) cannot pass.
- **US3 (Phase 5)**: needs Phase 2 + `010`'s resume-payment flow to exist (to have more than one attempt to create/resolve).
- **US4 (Phase 6)**: needs Phase 2 only — its tests are about the mechanism itself, not any specific table's data.
- **Polish (Phase 7)**: after all desired stories are done.

### Parallel Opportunities

- `[P]`-marked DB-level test files (T005, T008, T009, T010, T011) run in parallel once Phase 2 is complete and each phase's own prerequisite (e.g., T007 for T008) is done.
- Phase 7: T012 and T013 in parallel.

## Implementation Strategy

**MVP first**: Phase 2 (the generic trigger + attachment to all three tables in one migration) → Phase 3 (US1, Products — the highest-value, most-exercised case, and the one requiring zero application-code changes) is enough to prove the mechanism end-to-end.

**Incremental delivery**: Phase 4 (US2, Orders — requires T007's one-line webhook fix) and Phase 5 (US3, payment attempts) can follow in either order or in parallel, then Phase 6 (US4, the immutability/completeness guarantees, provable independently of any specific table), then Phase 7 (polish, including documenting the now-load-bearing actor-setting convention for future features).
