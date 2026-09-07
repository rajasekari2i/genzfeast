# Tasks: Resume Payment on a Pending Order

**Input**: Design documents from `/specs/010-resume-pending-order-payment/` (spec.md, plan.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md)

**Tests**: Included — `plan.md`'s Testing section names the race-condition scenarios (stale success honored, stale failure ignored) as the highest-value tests in this feature, since they validate the actual correctness bug being fixed, not just the widened-eligibility happy path.

**Organization**: Tasks are grouped by user story (spec.md priorities P1/P2/P1), then Mobile, then Polish. No spec ambiguity was found during task planning — this is the most rigorously self-audited spec of the ten so far: its own research.md §1 identifies, by name, the exact correctness bug a naive implementation would introduce (a late-arriving success for a superseded payment attempt getting silently dropped) and designs the `payment_attempts`/`is_current` asymmetric reconciliation rule specifically to close it.

## This feature amends `006` and `008` — it does not create a new module

Every backend task below modifies files `006-student-browse-cart-checkout` already owns (`student-orders.service.ts`, `payments.service.ts`) rather than creating new ones. If `006` hasn't been implemented yet when this feature is picked up, build `006`'s tasks with this feature's amendments already folded in from the start (see each task's note below) rather than implementing `006`'s original design first and then changing it — the naive single-`payment_gateway_ref`-column design this feature replaces (research.md §1) should never actually be shipped.

## Phase 1: Setup

- [ ] None — no new dependency, env var, or config.

---

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T001 Add `PaymentAttempt` model to `api/prisma/schema.prisma` per data-model.md §1 (`gateway_ref` unique, `is_current` boolean, `outcome` nullable enum, FK to `Order`)
- [x] T002 Write the Prisma migration in `api/prisma/migrations/<timestamp>_payment_attempts/migration.sql`: the `payment_attempts` table, `UNIQUE (gateway_ref)`, the partial unique index `UNIQUE (order_id) WHERE is_current = true` (data-model.md §1, enforcing "exactly one current attempt" at the DB layer), and its RLS policy (`via_owning_order`, joined through `orders`' existing visibility rules — no `system_admin` bypass)
- [x] T003 **Amend `006`'s `StudentOrdersService.placeOrder`** (`api/src/student-orders/student-orders.service.ts`) so order creation also inserts the **first** `payment_attempts` row (`is_current: true`, `gateway_ref` from the Razorpay session just opened) — not only `orders.payment_gateway_ref` as `006` originally did. Every order, from its very first attempt onward, must have a `payment_attempts` row for the webhook lookup (research.md §1, §3) to ever find it.

**Checkpoint**: Schema in place, and even a brand-new order's first attempt is tracked — user story work can begin.

---

## Phase 3: User Story 1 - Student Resumes Payment on a Still-Pending Order (Priority: P1) 🎯 MVP

**Goal**: `POST /student/orders/{orderId}/retry-payment` accepts `payment_pending` (not only `payment_failed`), creates a new current attempt without creating a new order, and hands the student off to pay again.

**Independent Test**: Resuming a `payment_pending` order returns `200` with a fresh payment session on the same order id; exactly one order still exists afterward; a subsequent success webhook places it normally.

- [x] T004 [US1] **Amend `006`'s `StudentOrdersService.retryPayment`** (`api/src/student-orders/student-orders.service.ts`): widen eligibility to `status IN ('payment_pending', 'payment_failed')` (previously `payment_failed` only) — `409` remains for `order_placed`/`delivered` (FR-001, FR-004, research.md §4); on any eligible call, open a new Razorpay session, insert a new `payment_attempts` row (`is_current: true`), and set every other `payment_attempts` row for this `order_id` to `is_current: false` in the same transaction (research.md §2) — update `orders.payment_gateway_ref` too, purely as the now-denormalized convenience copy (data-model.md §"Changed meaning"); never insert a new `orders` row (FR-002, FR-003)
- [ ] T005 [P] [US1] Contract tests in `api/test/contract/student-orders/resume-payment.spec.ts`: resuming a `payment_pending` order returns `200` (not the old `409`) with a fresh `gateway_ref`; `GET /student/orders` shows exactly one order throughout; a success webhook for the new attempt's `gateway_ref` places the order normally with a pickup code; resuming an already-`order_placed` order still returns `409` (FR-001 thru FR-004, quickstart Scenarios 1-2)

**Checkpoint**: A student can resume a pending order and it works end-to-end on the happy path.

---

## Phase 4: User Story 3 - Multiple Payment Attempts Never Cause a Duplicate Outcome (Priority: P1)

**Goal**: The webhook's reconciliation logic honors the *first* success regardless of which attempt it's for, but only honors a failure when it's for the *current* attempt — implementing research.md §2's asymmetric rule exactly.

**Independent Test**: A stale (superseded) attempt's late success still places the order; a stale attempt's late failure is silently ignored and never flips an order that a newer attempt might still complete.

- [x] T006 [US3] **Amend `006`'s `PaymentsService.handleWebhook`** (`api/src/payments/payments.service.ts`): change the lookup key from `orders.payment_gateway_ref` to `payment_attempts.gateway_ref` (research.md §3 — this is the actual bug fix; a lookup against the single, overwritable `orders` column would silently drop a late confirmation for a superseded attempt); on finding the attempt, apply data-model.md's Reconciliation Logic Summary table exactly: **success** → if the order is still `payment_pending`, transition it to `order_placed` + generate the OTP regardless of whether this attempt is current or superseded (research.md §2 — "a success is always honored"); **failure** → transition the order to `payment_failed` **only if** this attempt is both current **and** the order is still `payment_pending` — a superseded attempt's failure must never finalize the order (FR-006, FR-007); either way, write the attempt's own `outcome`/`resolved_at`, and if the order was already finalized (either status), make no order-level change but still record the attempt's outcome for audit
- [ ] T007 [P] [US3] The two highest-value tests in this feature, in `api/test/webhook/payments-webhook/resume-payment-race-conditions.spec.ts` (extending `006`'s existing webhook suite): (a) **stale success honored** — attempt 1 superseded by attempt 2, then attempt 1's success webhook still places the order with a pickup code; a subsequent success webhook for attempt 2 causes no further change (no second pickup code, order not re-placed); (b) **stale failure ignored** — attempt 1 superseded by attempt 2, then attempt 1's failure webhook leaves the order untouched at `payment_pending`, confirmed via a follow-up `GET`; a subsequent success webhook for attempt 2 then places the order normally, completely unaffected by attempt 1's earlier, correctly-ignored failure (FR-006, FR-007, SC-002, SC-003, quickstart Scenarios 3-4 — "the one that matters most," per quickstart's own Pass/Fail note)

**Checkpoint**: The feature's actual correctness guarantee — no duplicate placement, no lost payment — is independently proven, not just asserted.

---

## Phase 5: User Story 2 - Order Detail Shows an Actionable Prompt for a Pending Order (Priority: P2)

**Goal**: A `payment_pending` order's detail view shows a distinct "payment in progress" indication and a Resume Payment action, purely derived from the `status` field `006`/`008` already return.

**Independent Test**: Opening a `payment_pending` order's detail shows the banner + action; reopening it after it's since become placed/failed shows that status's content instead.

- [x] T008 [US2] No backend task — `008`'s `OrderDetail` response already includes `status`; this story requires no new field (research.md §5, mirroring `008`'s existing `payment_failed` → Pay Again derivation pattern). Documenting explicitly so this phase isn't mistaken for a missed backend task.
- [ ] T009 [P] [US2] Contract test in `api/test/contract/student-orders/order-detail-pending-status.spec.ts` (extending `008`'s existing per-status shape suite): confirm `GET /student/orders/{id}` for a `payment_pending` order returns `status: payment_pending` and no misleading `otp`/`delivered_at` values, exactly matching the shape `008` already validates for its other three statuses (FR-005, quickstart Scenario 5)

---

## Phase 6: Mobile

- [x] T010 Extend `mobile/src/screens/student/OrderDetailScreen.tsx` (already shared across specs 006/008/010, currently a bare stub) with the `payment_pending` case: a distinct "Payment in progress" banner + "Resume Payment" button, calling the same `POST /student/orders/:orderId/retry-payment` endpoint and re-launching the Razorpay checkout flow already built for `006`'s "Pay Again" (no new client-side payment integration needed — same call, same downstream flow, different trigger point)

---

## Phase 7: Polish

- [ ] T011 [P] Update the `POST /student/orders/{orderId}/retry-payment` entry in `api/postman/GenzFeast-API.postman_collection.json` (from `006`) to note the widened eligibility
- [ ] T012 Run every scenario in `specs/010-resume-pending-order-payment/quickstart.md` end-to-end against a local run of the API — **Scenarios 3 and 4 are the ones that matter most** per quickstart's own Pass/Fail note; fix any drift found

---

## Dependencies & Execution Order

- **Foundational (Phase 2)**: T001/T002 (schema) block everything; T003 (first-attempt tracking on order creation) must land before T006's webhook reconciliation can find *any* order's attempts, including one that's never been resumed.
- **US1 (Phase 3)**: needs Phase 2. Independently testable on the happy path — the MVP entry point.
- **US3 (Phase 4)**: needs Phase 2 (T003) + US1 (T004, to ever have more than one attempt to race between) — this is the feature's actual correctness core, not an optional refinement.
- **US2 (Phase 5)**: independent of US1/US3 beyond needing `status` to already reflect `payment_pending` correctly (already true from `006`).
- **Mobile (Phase 6)**: needs US1 (T004) live.
- **Polish (Phase 7)**: after all desired stories are done.

### Parallel Opportunities

- `[P]`-marked contract/webhook tests run in parallel once their corresponding implementation task is done.
- US2 (Phase 5) can be built in parallel with US1/US3, since it touches no shared implementation file.
- Phase 7: T011 in parallel with T012.

## Implementation Strategy

**MVP first**: Phase 2 (including T003's first-attempt tracking — do not skip this even though it looks like it belongs to "later") → Phase 3 (US1, resume works on the happy path) → Phase 4 (US3, the race-condition guarantee) — do not consider this feature done, or safe to demo, without Phase 4's two tests passing; the happy path alone (Phase 3) reintroduces exactly the bug research.md §1 warns about the moment two attempts exist on the same order.

**Incremental delivery**: Phase 5 (US2, the Order Detail prompt) can be built any time in parallel, then Phase 6 (mobile), then Phase 7 (polish, with Scenarios 3-4 as the non-negotiable quickstart checks).
