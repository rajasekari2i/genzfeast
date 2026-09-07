# Tasks: Browse, Cart & Checkout with Payment

**Input**: Design documents from `/specs/006-student-browse-cart-checkout/` (spec.md, plan.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md)

**Tests**: Included — `plan.md`'s Testing section commits to Jest + Supertest contract tests plus a dedicated webhook test suite (the highest-risk surface in this feature).

**Organization**: Tasks are grouped by user story (spec.md priorities P1×4/P2), then a dedicated Webhook-hardening phase, then Mobile, then Polish. No spec ambiguity was found during task planning — this is the most cross-referenced spec of the six so far: `research.md` §7 explicitly verifies it satisfies every column `005-staff-order-fulfilment-otp` declared as a dependency contract, and `coding_standard.md` §4.3/§12 already codifies the webhook's RLS-bypass trust boundary (research.md §4, §6) as a project-wide rule, not something invented ad hoc here.

## This feature completes `005`'s dependency (read first)

`005-staff-order-fulfilment-otp` declared an `orders` consumer contract without owning the table. This feature **fully migrates `orders`** and must match that contract exactly (column names, `status` values including `order_placed`/`delivered`, plaintext-readable `otp`, `total_amount` as integer). Once this feature's migration lands, `005`'s own tasks.md T019 (re-run its suite against the real table) should be executed as a cross-feature follow-up.

## Pre-existing foundation (reused, not re-built)

- `JwtAuthGuard`, `RolesGuard` + `@Roles(...)`, `TenantContextInterceptor`, `TenantPrismaService.runInTenantContext()` (including its `systemActor` context path, already built with exactly this webhook use case in mind — see `api/src/common/prisma/tenant-prisma.service.ts`'s own doc comment).
- `004`'s `products` table (read-only here) for browsing/availability checks.
- Mobile: `mobile/src/screens/student/HomeScreen.tsx` already has a fully-built local cart interaction model (add/increment/decrement, running total, `CartSummaryBar`) against `MOCK_PRODUCTS` — per its own comment, this is intentionally structured so only the data source needs to change, not the state shape. `CartScreen.tsx` and `OrderDetailScreen.tsx` are stubs; `OrderDetailScreen.tsx` already serves double duty across specs 006/008/010 (status-specific content: OTP / Pay Again / Delivered / Resume Payment) per its own doc comment — extend it, don't fork a separate confirmation screen.
- No Razorpay dependency exists yet in `api/package.json`.

## Phase 1: Setup

- [x] T001 Add a Razorpay SDK dependency to `api/package.json` and `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`/`RAZORPAY_WEBHOOK_SECRET` to the env schema in `api/src/common/config/env.validation.ts` + `api/.env.example` (research.md §4)

---

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T002 Add `Order` model to `api/prisma/schema.prisma` per data-model.md §1 (all columns, `CHECK (total_amount > 0)`, `CHECK (fulfilment_type = 'pickup')`)
- [x] T003 Write the Prisma migration in `api/prisma/migrations/<timestamp>_orders/migration.sql`: the `orders` table, the partial unique index `UNIQUE (user_id) WHERE status IN ('payment_pending','payment_failed')` (FR-016, research.md §3), and the four role-conditional RLS policies from data-model.md (`student_own_orders`, `student_create_own_orders`, `staff_company_orders`, `staff_deliver_own_company_orders`) — **no `system_admin` bypass**
- [x] T004 [P] Implement `RazorpayService` in `api/src/payments/razorpay.service.ts`: `createOrder(amount)` → gateway ref, `verifyWebhookSignature(payload, signatureHeader)` → boolean (HMAC-SHA256 per research.md §4) — pure gateway-client wrapper, no DB access
- [x] T005 Create `StudentOrdersModule` (`api/src/student-orders/`) and `PaymentsModule` (`api/src/payments/`), each wired independently per plan.md's trust-boundary separation; register both in `api/src/app.module.ts`

**Checkpoint**: Schema + gateway client seam exist — user story work can begin.

---

## Phase 3: User Story 1 - Browse the Menu and Build a Cart (Priority: P1) 🎯 MVP

**Goal**: A student sees their own Company's non-removed products, sold-out ones clearly flagged and unaddable — cart interaction itself is already built client-side (mobile foundation above).

**Independent Test**: `GET /student/products` returns only the caller's own Company's non-removed products; a Company B student never sees Company A's catalog.

- [x] T006 [US1] Implement `StudentOrdersService.listProducts(ctx)` in `api/src/student-orders/student-orders.service.ts` — reuses `004`'s `products` table (non-`is_deleted` rows only) via `TenantPrismaService`, mapped to `ProductForBrowsing` (FR-001, FR-002)
- [x] T007 [US1] `StudentOrdersController`: `GET /student/products` in `api/src/student-orders/student-orders.controller.ts`, `@Roles('student')`
- [ ] T008 [P] [US1] Contract test in `api/test/contract/student-orders/browse.spec.ts`: returns only the caller's company's non-removed products; a toggled-sold-out product (via `004`'s endpoint) shows `is_soldout: true`; a Company B student never sees Company A's catalog (FR-001, FR-002, FR-017, SC-005)

**Checkpoint**: Browsing works, correctly tenant-scoped — the cart itself needs no backend work per research.md §1.

---

## Phase 4: User Story 2 - Review and Adjust the Cart (Priority: P1)

**Goal**: Purely client-side — no new backend surface (research.md §1: "no cart-related table or endpoint until `POST /student/orders`").

**Independent Test**: Mobile-only — see Phase 8 (T022).

- [x] T009 [US2] No backend task — this story is fully satisfied by mobile cart state (Phase 8, T022) reading live product data from US1's endpoint. Documenting explicitly so this phase isn't mistaken for a missed backend task.

---

## Phase 5: User Story 3 - Place the Order and Pay (Priority: P1)

**Goal**: Placing an order re-validates every item server-side, never trusts client-supplied price/name, creates an immutable snapshot, and opens a Razorpay payment session — or returns an already-outstanding order instead of creating a duplicate.

**Independent Test**: An item that went sold out since being added → `409`, no order created; a valid cart → `201` with a snapshot matching *current* server-side product data, not anything the client sent; placing again while one order is still unresolved → `200` with the existing order, not a new one.

- [x] T010 [P] [US3] `PlaceOrderRequestDto` (`items: [{product_id, quantity}]`, optional `payment_method`) in `api/src/student-orders/dto/place-order.dto.ts` (contracts/openapi.yaml `PlaceOrderRequest`)
- [x] T011 [US3] Implement `StudentOrdersService.placeOrder(ctx, dto)` in `api/src/student-orders/student-orders.service.ts`: first check for an existing `payment_pending`/`payment_failed` order for `ctx.userId` — if found, return it as-is (`200`, FR-016), no insert attempted; otherwise look up each `product_id` server-side (current `name`/`price`/`is_soldout`/`is_deleted`), reject the whole request with `409` + `unavailable_product_ids` if any is unavailable, creating nothing (FR-008); otherwise build the immutable `items` snapshot + `total_amount` from that server-side data alone (never the client's) (FR-009, FR-020, research.md §2), insert the order (`status: payment_pending`), call `RazorpayService.createOrder` and store `payment_gateway_ref`, return `201` with `OrderWithPaymentSession`
- [x] T012 [US3] `StudentOrdersController`: `GET /student/orders`, `POST /student/orders` in `api/src/student-orders/student-orders.controller.ts`, `@Roles('student')` per contracts/openapi.yaml
- [ ] T013 [P] [US3] Contract tests in `api/test/contract/student-orders/place-order.spec.ts`: a cart containing a since-sold-out item → `409`, `unavailable_product_ids` correct, no order row created (confirmed via `GET /student/orders`); a valid cart → `201`, snapshotted `price`/`name` match current server-side product data regardless of what the request body sent; placing again while the first order is still `payment_pending` → `200` with the *same* order id, not a new one (FR-008, FR-009, FR-016, FR-020, quickstart Scenario 2)

**Checkpoint**: Order creation is trustworthy and duplicate-proof.

---

## Phase 6: User Story 4 - Payment Success Confirms the Order with a Pickup Code (Priority: P1)

**Goal**: Only a verified, server-to-server Razorpay webhook — never a client redirect — finalizes payment; success generates a re-viewable pickup code; the webhook is idempotent against redelivery.

**Independent Test**: A simulated `payment.success` webhook flips the order to `order_placed` with an OTP that stays visible on repeat views; a replayed webhook causes no second transition; a `payment.failed` webhook flips it to `payment_failed` with no OTP.

- [x] T014 [US4] Implement `PaymentsService.handleWebhook(payload, signatureHeader)` in `api/src/payments/payments.service.ts`: reject with `400` if `RazorpayService.verifyWebhookSignature` fails (before touching the DB); otherwise look up the order by `payment_gateway_ref` using a trusted service-role connection (`TenantPrismaService`'s `systemActor` context, per coding_standard.md §4.3/§12 and the existing doc comment on `tenant-prisma.service.ts` — **not** a general RLS bypass reused elsewhere); if the order's `status` is no longer `payment_pending`, acknowledge with `200` and make **no** further change (idempotency guard, research.md §5); otherwise on `payment.success` — generate a 6-digit numeric OTP (plaintext, research.md §2/data-model.md), set `status: order_placed`, `payment_status: success`, `otp`; on `payment.failed` — set `status: payment_failed`, `payment_status: failed`, `otp` stays `null`; either way write the corresponding `order_audit_logs` event (FR-011, FR-012, FR-014)
- [x] T015 [US4] `PaymentsController`: `POST /payments/webhook` in `api/src/payments/payments.controller.ts` — no `JwtAuthGuard` (this caller is the gateway, not a user); reads the `X-Razorpay-Signature` header per contracts/openapi.yaml
- [x] T016 [US4] Implement `StudentOrdersService.getOrder(ctx, orderId)` / extend `listOrders(ctx)` — tenant/owner-scoped lookup; `otp` is included in the response only while `status = 'order_placed'`, omitted once `delivered` (FR-013) — a 404 (not 403) for any order that doesn't exist or isn't the caller's own, so cross-student access reveals nothing (contracts/openapi.yaml `NotFound`)
- [x] T017 [US4] `StudentOrdersController`: `GET /student/orders/:orderId` per contracts/openapi.yaml
- [ ] T018 [P] [US4] Contract tests in `api/test/contract/student-orders/order-detail-and-webhook.spec.ts`: successful webhook → order becomes `order_placed` with a populated `otp`; a follow-up `GET` still shows the identical `otp` (FR-013); a second identical webhook delivery is acknowledged `200` but `otp`/`updated_at` are unchanged (research.md §5); a different student (any company) requesting this order id gets `404` (FR-013, FR-017, SC-005, SC-006, quickstart Scenario 3)

**Checkpoint**: End-to-end paid order flow (browse → place → pay → confirmed with OTP) works — this closes the loop with `005`'s consumer contract.

---

## Phase 7: User Story 5 - Retry After a Failed Payment (Priority: P2)

**Goal**: A failed order can be retried on the exact same row — never a new order.

**Independent Test**: A `payment_failed` order → retry opens a fresh payment session on the *same* order id; a subsequent success webhook transitions that same order, never creates a second one.

- [x] T019 [US5] Implement `StudentOrdersService.retryPayment(ctx, orderId)` in `api/src/student-orders/student-orders.service.ts` — requires the order to be `payment_failed` (else `409`); opens a new `RazorpayService.createOrder` session and overwrites `payment_gateway_ref` on the same row (FR-014, FR-015) — no new `orders` row ever inserted
- [x] T020 [US5] `StudentOrdersController`: `POST /student/orders/:orderId/retry-payment` per contracts/openapi.yaml
- [ ] T021 [P] [US5] Contract tests in `api/test/contract/student-orders/retry-payment.spec.ts`: retry on a `payment_failed` order returns a new `payment_session.gateway_ref` but the identical order `id`; a follow-up success webhook (targeting the new `gateway_ref`) transitions that same order to `order_placed`; retry on a non-`payment_failed` order → `409`; `GET /student/orders` confirms exactly one order exists for the student throughout (FR-014, FR-015, SC-004, quickstart Scenario 4)

**Checkpoint**: All five user stories independently pass — quickstart.md Scenarios 1–5 should now all pass.

---

## Phase 8: Mobile (Student surface)

- [x] T022 Wire `mobile/src/screens/student/HomeScreen.tsx` to real `GET /student/products`, replacing `MOCK_PRODUCTS`/`MOCK_CATEGORIES` — keep the existing cart state shape (`Record<productId, quantity>`) and `CartSummaryBar` wiring unchanged per the screen's own comment
- [x] T023 Wire `mobile/src/screens/student/CartScreen.tsx` (currently a bare stub) per UI Design §4.6: cart lines (name, description, qty stepper, line total) sourced from Home's cart state passed via navigation/shared state, overall Total Amount, auto-selected payment method (single V1 option), "Place Order" calling `POST /student/orders`; on `409` show which item(s) are unavailable inline (don't silently drop them from the cart — re-fetch and let the student decide, matching FR-006's "stays visible" spirit even at checkout time)
- [x] T024 On successful order placement (`201`/`200` from T023), launch the Razorpay UPI checkout/payment-intent flow using `payment_session.gateway_ref`, then navigate to `OrderDetailScreen`
- [x] T025 Extend `mobile/src/screens/student/OrderDetailScreen.tsx` (already shared across specs 006/008/010) to render `GET /student/orders/:orderId`'s status-specific content per UI Design: `order_placed` → "Order Placed Successfully" + the OTP (FR-013); `payment_failed` → "Payment Failed" + a "Pay Again" action calling `POST /student/orders/:orderId/retry-payment` then re-launching checkout (T024's flow); `delivered` → no OTP shown

---

## Phase 9: Webhook Hardening (dedicated, per plan.md's risk call-out)

- [ ] T026 [P] Dedicated webhook test suite in `api/test/webhook/payments-webhook/signature-and-idempotency.spec.ts`: missing/invalid/tampered signature → `400`, zero DB writes; a well-formed but unrecognized `gateway_ref` → acknowledged without error (no matching order to update) rather than a crash; the full idempotent-replay assertion from T018 repeated here as the canonical webhook-focused test (plan.md: "the webhook path is the highest-risk surface in this feature and warrants its own focused coverage beyond generic contract tests")

---

## Phase 10: RLS & Polish

- [ ] T027 [P] RLS test in `api/test/rls/orders-role-conditional.spec.ts`: a student cannot see another student's order even within the same company (`student_own_orders`); `staff`/`company_admin` see every order in their own company but never another company's; no `system_admin` bypass exists (data-model.md §"Row Level Security")
- [ ] T028 [P] Add `/student/products`, `/student/orders*`, and `/payments/webhook` requests to `api/postman/GenzFeast-API.postman_collection.json`
- [ ] T029 Run every scenario in `specs/006-student-browse-cart-checkout/quickstart.md` end-to-end against a local run of the API (using a signed test-webhook helper, not the real gateway); fix any drift found
- [ ] T030 Cross-feature follow-up: once this feature's `orders` migration lands, re-run `005-staff-order-fulfilment-otp`'s full contract-test suite against the real table (that feature's own tasks.md T019) instead of its fixtures, and reconcile any drift

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)**: blocks every user story.
- **US1 (Phase 3)**: needs Phase 2 only. Independently testable — the MVP entry point (browsing).
- **US2 (Phase 4)**: no backend dependency; satisfied entirely by Phase 8's mobile work once US1's endpoint exists.
- **US3 (Phase 5)**: needs Phase 2 + US1 (products to validate against).
- **US4 (Phase 6)**: needs US3 (an order to pay for) + Phase 2's `RazorpayService` seam (T004).
- **US5 (Phase 7)**: needs US4's webhook logic (a `payment_failed` order to retry).
- **Webhook Hardening (Phase 9)**: needs US4 (T014) to exist; can run any time after.
- **Mobile (Phase 8)**: needs US1/US3/US4/US5's endpoints live.
- **RLS & Polish (Phase 10)**: after all desired stories are done; T030 is externally gated on this feature's own migration landing, then re-runs `005`'s suite.

### Parallel Opportunities

- Phase 2: T004 alongside T002/T003.
- Within each user story phase, `[P]`-marked DTOs/tests run in parallel once that phase's core implementation task is done.
- Phase 10: T027, T028 in parallel.

## Implementation Strategy

**MVP first**: Phase 1 → Phase 2 → Phase 3 (US1, browse) → Phase 5 (US3, place order) → Phase 6 (US4, payment confirmation) — these three P1 stories (plus US2's client-side cart, free once US1 exists) form the commercial core: a student can browse, order, pay, and get a pickup code.

**Incremental delivery**: add Phase 7 (US5, retry) next, then Phase 9 (dedicated webhook hardening — do not skip given plan.md's explicit risk call-out on this surface), then Phase 8 (mobile), then Phase 10 (polish, including the mandatory `005` reconciliation pass in T030).
