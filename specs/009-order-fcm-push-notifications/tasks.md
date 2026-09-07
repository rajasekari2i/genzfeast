# Tasks: Order OTP & Ready-for-Pickup Push Notifications

**Input**: Design documents from `/specs/009-order-fcm-push-notifications/` (spec.md, plan.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md)

**Tests**: Included — `plan.md`'s Testing section commits to Jest + Supertest for device registration, a mocked-FCM integration suite for the webhook-triggered send path, and cascade-deletion tests extending `002`'s logout/lock tests and `007`'s change-password tests.

**Organization**: Tasks are grouped by user story (spec.md priorities P1×2/P2×2), then the cross-feature unauthenticated-registration piece for `003`, then Mobile, then Polish.

## Cross-feature contradiction found and resolved during this feature's own task planning (read first)

FR-008's account-lock cascade (mirroring `002`'s full session revocation on lock) deletes every device registration for a user — but `003-forgot-password-otp-reset`'s recovery push (already committed to FCM-data-payload delivery) needs a live registration to reach exactly that case, since a locked account is `003`'s primary use case. This was resolved via `/speckit-clarify` into **FR-011**: an unauthenticated device-registration path (`refresh_token_id: NULL`, exempt from every session-based cascade) that `003`'s `POST /auth/forgot-password/request` calls directly. See spec.md Clarifications and research.md §7. `003`'s own tasks.md (T005/T006/T008/T023) was updated in the same pass to call this feature's `DevicesService.upsertUnauthenticated(...)` — Phase 6 below is the implementation side of that contract.

## Dependencies on other modules

- **`002-registration-login-jwt-auth`**: `refresh_tokens` table and its `/auth/logout`/account-lock code paths, both extended here (Phase 5).
- **`006-student-browse-cart-checkout`**: the `orders` table and its payment-webhook handler, extended here (Phase 4) to send the notification at the exact `payment_pending → order_placed` transition.
- **`005-staff-order-fulfilment-otp`**: `order_audit_logs`, extended here with two new event types (Phase 4).
- **`007-user-profile-management`**: its change-password flow, extended here (Phase 5).
- **`003-forgot-password-otp-reset`**: the *caller* of this feature's unauthenticated registration path (Phase 6) — not a dependency of this feature, but this feature is now a dependency of `003`'s FR-017.

If any of `002`/`005`/`006`/`007` haven't landed yet when this feature is implemented, treat the specific extension points named above as the blocker for that one phase only — Phase 1-3 (setup, foundational, device registration itself) depend only on `002`'s already-existing `refresh_tokens` table.

## Phase 1: Setup

- [ ] T001 Add a Firebase Admin SDK (`firebase-admin`) dependency to `api/package.json`, and `FIREBASE_SERVICE_ACCOUNT_JSON` (or equivalent credential config) to the env schema in `api/src/common/config/env.validation.ts` + `api/.env.example` (plan.md — first feature to actually need this dependency)

---

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T002 Add `DeviceRegistration` model to `api/prisma/schema.prisma` per data-model.md §1 (`fcm_token` unique, `refresh_token_id` **nullable** FK to `RefreshToken` — research.md §7)
- [x] T003 Write the Prisma migration in `api/prisma/migrations/<timestamp>_device_registrations/migration.sql`: the `device_registrations` table, `UNIQUE (fcm_token)`, and its RLS policy (`user_id`-scoped, no `system_admin` bypass, per data-model.md)
- [x] T004 [P] Implement `FcmService` in `api/src/notifications/fcm.service.ts` — `sendToToken(token, {title, body, data})` wrapping the Firebase Admin SDK, mapping provider errors to a simple success/failure result the caller can log; pure gateway-client wrapper, no DB access
- [x] T005 Create `NotificationsModule` in `api/src/notifications/notifications.module.ts` wiring `DevicesService`/`FcmService`; register in `api/src/app.module.ts`

**Checkpoint**: Schema + gateway client seam exist — user story work can begin.

---

## Phase 3: User Story 1 - A Device Registers to Receive Notifications (Priority: P1) 🎯 MVP

**Goal**: A logged-in device registers its FCM token, linked to its own session; multiple devices per user coexist; re-registering the same token upserts rather than duplicates.

**Independent Test**: Two devices register independently and both persist; re-registering one of them updates that same row, not a new one.

- [x] T006 [P] [US1] `DeviceRegistrationDto` (`fcm_token`, `refresh_token`) in `api/src/notifications/dto/device-registration.dto.ts`
- [x] T007 [US1] Implement `DevicesService.register(ctx, dto)` in `api/src/notifications/devices.service.ts`: resolve `dto.refresh_token` to its `refresh_tokens.id` for the caller (reusing `002`'s lookup-by-hash pattern; reject `401` if it doesn't resolve to an active session for `ctx.userId`), then `UPSERT` on `fcm_token` — `user_id`, `refresh_token_id`, `updated_at` overwritten (FR-001, FR-002, FR-003, research.md §1-§2)
- [x] T008 [US1] `DevicesController`: `POST /me/devices` in `api/src/notifications/devices.controller.ts`, `@UseGuards(JwtAuthGuard)` per contracts/openapi.yaml
- [ ] T009 [P] [US1] Contract tests in `api/test/contract/devices/register.spec.ts`: two devices for the same user both persist independently (FR-002); re-registering the same `fcm_token` updates the existing row rather than creating a second one (FR-003); registering a token previously owned by a *different* account reassigns it — the old account's device list no longer includes it (FR-009, Edge Case, quickstart Scenario 1)

**Checkpoint**: Device registration works — the enabling capability every other story depends on.

---

## Phase 4: User Story 2 - Student Receives a Push Notification When Their Order Is Confirmed (Priority: P1)

**Goal**: The exact moment `006`'s webhook transitions an order to `order_placed`, every one of that student's registered devices gets a push carrying the pickup code — fire-and-forget, never blocking or failing the webhook itself.

**Independent Test**: A simulated payment-success webhook triggers exactly one send per registered device, each logged to `order_audit_logs`; a total send failure still leaves the order correctly placed and its pickup code available in-app.

- [x] T010 [US2] Extend `006`'s `PaymentsService.handleWebhook(...)` (`api/src/payments/payments.service.ts`) at the exact point it sets `status: 'order_placed'`: look up every `device_registrations` row for the order's `user_id`, and for each, call `FcmService.sendToToken` with `{title, body}` announcing pickup-readiness plus `data: {order_id}` (research.md §4, §6) — **fire-and-forget**: do not `await` in a way that blocks or can fail the webhook's own response (FR-004, FR-005, plan.md's fire-and-forget constraint)
- [x] T011 [US2] For each send attempt, write `order_ready_notification_sent` or `order_ready_notification_failed` to `005`'s `order_audit_logs` (FR-010, research.md §5) — this write itself must also never block/fail the webhook response
- [ ] T012 [P] [US2] Mocked-FCM integration tests in `api/test/integration/order-notifications/webhook-fanout.spec.ts`: a student with two registered devices gets exactly two send attempts on payment success, each carrying the order's pickup code and `data.order_id`; both `order_audit_logs` rows are written; a `payment_failed` or plain order-creation transition triggers **zero** sends (FR-005); a total send failure (both devices mocked as invalid) still leaves the webhook returning success and `GET /student/orders/{id}` still showing the pickup code normally (FR-006, SC-002, quickstart Scenario 2-3)

**Checkpoint**: The feature's core value — students get notified — works, without ever risking order/payment correctness.

---

## Phase 5: User Story 4 - A Device Stops Receiving Notifications After Logout (Priority: P2)

**Goal**: Logout, account-lock, and password-change all cascade into removing the affected device registration(s), precisely — not too broadly, not too narrowly.

**Independent Test**: Logging out one of two devices removes only that device's registration; locking the account removes both; a password change removes every registration except the one identified as current.

- [x] T013 [US4] Extend `002`'s `/auth/logout` path (`api/src/auth/auth.service.ts`) to also delete the `device_registrations` row matching the revoked `refresh_token_id` (FR-008, research.md §3)
- [x] T014 [US4] Extend `002`'s account-lock path (the same `AuthService.revokeAllSessions` call site used at the 5th failed login) to also delete every `device_registrations` row for that `user_id` (FR-008, research.md §3)
- [x] T015 [US4] Extend `007`'s change-password path (`api/src/profile/profile.service.ts`'s call into `revokeAllSessions(userId, exceptRefreshTokenId)`) to also delete every `device_registrations` row whose `refresh_token_id` is among the ones just revoked, leaving the current device's registration untouched (FR-008, research.md §3)
- [ ] T016 [P] [US4] Extend `002`'s existing logout/lock contract tests and `007`'s existing change-password contract tests with device-registration assertions: logout removes only the matching device's row; lock removes every row for the user; password-change removes every row except the identified current session's (FR-008, SC-004, quickstart Scenario 4-5)

**Checkpoint**: Stale devices never keep receiving notifications after their session ends.

---

## Phase 6: Unauthenticated Registration for `003`'s Locked-Account Recovery (FR-011)

**Goal**: `003`'s forgot-password request can register a device with no session at all, so a locked account (whose Phase 5 cascade just wiped every registration) still has a channel for its recovery push.

**Independent Test**: A locked account with zero device registrations, upon a forgot-password request carrying an `fcm_token`, gets exactly one new registration (`refresh_token_id: NULL`) — and a request for a non-existent username creates none.

- [x] T017 Implement `DevicesService.upsertUnauthenticated(userId, fcmToken)` in `api/src/notifications/devices.service.ts` — same `UNIQUE(fcm_token)` upsert as T007, but writes `refresh_token_id: NULL` and runs under a trusted service-role/system-actor `TenantPrismaService` context (no `app.current_user_id` exists for this caller — research.md §7, the same pattern `006`'s payment webhook already uses for its own no-session write path)
- [x] T018 Export `DevicesService` from `NotificationsModule` (T005) so `003`'s `AuthModule` can inject it; this is the call site `003`'s own tasks.md T006 already stubbed pending this feature's existence
- [ ] T019 [P] Contract test in `api/test/integration/order-notifications/unauthenticated-registration.spec.ts`: a forgot-password request (simulated, not `003`'s full flow) with a valid `(company_id, username)` and `fcm_token` creates exactly one `device_registrations` row with `refresh_token_id: NULL`; the same call for a non-resolving username creates none; a later authenticated `POST /me/devices` registering the same token upgrades that row's `refresh_token_id` to the new session's id rather than creating a duplicate (FR-011, quickstart Scenario 6)

**Checkpoint**: A locked account always has a way to receive its recovery code — the cross-feature gap this task-planning pass surfaced is closed.

---

## Phase 7: User Story 3 - Tapping the Notification Opens the Order (Priority: P2, Mobile)

**Goal**: Tapping the notification deep-links straight to that order's detail.

- [x] T020 Implement `mobile/src/services/notifications/fcmClient.ts`: obtains the device's FCM token (Firebase SDK for Android/iOS), calls `POST /me/devices` with the caller's current `refresh_token` (on login and on the SDK's token-refresh callback — client-side trigger timing is an implementation detail per spec.md Assumptions), and registers a notification-tap handler that reads `data.order_id` from a delivered notification and navigates to `OrderDetail` for that id (research.md §6, FR-007)
- [ ] T021 [P] Manual/E2E verification: tapping a delivered order-confirmation notification opens the app directly to the correct order's detail (FR-007, SC-003, quickstart User Story 3) — a mobile deep-link test, not a backend contract test

---

## Phase 8: Polish

- [ ] T022 [P] Add `POST /me/devices` to `api/postman/GenzFeast-API.postman_collection.json`
- [ ] T023 Run every scenario in `specs/009-order-fcm-push-notifications/quickstart.md` end-to-end against a local run of the API (using a mocked FCM client for automated runs, a real dev Firebase project for manual verification); fix any drift found

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)**: blocks every user story.
- **US1 (Phase 3)**: needs Phase 2 only. Independently testable — the MVP entry point (nothing else works without a registered device).
- **US2 (Phase 4)**: needs US1 (a device to notify) + `006`'s existing webhook to extend.
- **US4 (Phase 5)**: needs US1 (a registration to remove) — its three cascade points (T013/T014/T015) are independent of each other and of US2, and can be built in parallel.
- **Unauthenticated Registration (Phase 6)**: needs Phase 2 (the nullable `refresh_token_id` column) + Phase 5's cascade logic already in place (so the exemption from it is meaningful) — otherwise independent of US2.
- **US3 (Phase 7)**: needs US1's registration flow (T020 depends on T007/T008) and US2's data payload shape (T010) to exist; this phase is mobile-only.
- **Polish (Phase 8)**: after all desired stories are done.

### Parallel Opportunities

- Phase 2: T004 alongside T002/T003.
- Phase 5: T013, T014, T015 (three different cascade call sites) in parallel.
- `[P]`-marked contract/integration tests run in parallel once their corresponding implementation task is done.
- Phase 8: T022 in parallel with T023.

## Implementation Strategy

**MVP first**: Phase 1 → Phase 2 → Phase 3 (US1, register) → Phase 4 (US2, notify on order confirmation) — the two P1 stories deliver the feature's actual value: a student gets notified without keeping the app open.

**Incremental delivery**: add Phase 5 (US4, cascade cleanup) next — a privacy/correctness safeguard, not a blocker to demonstrating the core flow — then Phase 6 (the `003` unauthenticated-registration fix this task-planning pass surfaced; do this before considering `003`'s own FR-017 shippable), then Phase 7 (US3, mobile deep-link), then Phase 8 (polish).
