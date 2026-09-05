# Quickstart: Validating Order OTP & Ready-for-Pickup Push Notifications

**Feature**: `009-order-fcm-push-notifications`

Manual/scriptable validation guide against `contracts/openapi.yaml` and `data-model.md`. Requires `002`'s and `006`'s migrations applied, plus the new `device_registrations` table and `005`'s extended `order_audit_logs` event types.

## Prerequisites

- A running API instance with Firebase Admin SDK configured against a test/dev Firebase project (or a mocked FCM client for automated tests).
- A Student account, logged in on two simulated "devices" (two separate login calls, each producing its own `access_token`/`refresh_token` pair per `002`).
- A way to simulate `006`'s `payment.success` webhook for a `payment_pending` order.

## Scenario 1 — Register a device (User Story 1)

1. On "device A," `POST /me/devices` with `{fcm_token: "token-A", refresh_token: <device A's refresh_token>}`.
   - **Expect**: `200`, `registered: true`. A `device_registrations` row now exists with `refresh_token_id` pointing at device A's session.
2. On "device B" (second login), `POST /me/devices` with `{fcm_token: "token-B", refresh_token: <device B's refresh_token>}`.
   - **Expect**: `200`. Two independent rows now exist for this user (FR-002) — confirm via a direct query that both remain, neither overwritten.
3. Re-register device A with the same `fcm_token: "token-A"` (simulating a token-refresh callback) and the same `refresh_token`.
   - **Expect**: `200`; still exactly one row for `token-A` (upsert, not a duplicate — FR-003).

## Scenario 2 — Order confirmation sends a notification to every device (User Story 2)

1. Simulate `006`'s `payment.success` webhook for a `payment_pending` order belonging to this student.
   - **Expect**: the order transitions to `order_placed` (per `006`), and — via the mocked FCM client — exactly two send attempts are made, one to `token-A` and one to `token-B`, each carrying the order's pickup code and `data.order_id`.
2. Check `order_audit_logs` for this order: two `order_ready_notification_sent` rows (one per device), assuming the mock reports success for both.
3. Simulate the mock FCM client reporting `token-B` as invalid/unregistered, then repeat step 1 for a second order.
   - **Expect**: the webhook still returns success and the order still becomes `order_placed` normally (FR-006) — one `order_ready_notification_sent` row (for `token-A`) and one `order_ready_notification_failed` row (for `token-B`) are written.

## Scenario 3 — Notification-independent in-app fallback (User Story 2, Scenario 3)

1. Simulate a payment success where **both** devices' FCM sends fail (mock both as invalid).
   - **Expect**: the webhook still returns success; `GET /student/orders/{id}` (from `006`/`008`) still returns the pickup code normally — completely unaffected by the notification outcome (SC-002).

## Scenario 4 — Logout removes only that device's registration (User Story 4)

1. `POST /auth/logout` (from `002`) using device A's `refresh_token`.
   - **Expect**: `204` (per `002`'s existing contract); the `device_registrations` row for `token-A` is now gone; the row for `token-B` remains untouched.
2. Simulate another `payment.success` webhook for this student.
   - **Expect**: only one send attempt now (to `token-B`) — device A no longer receives it.

## Scenario 5 — Lock and password-change cascades (User Story 4)

1. Re-register device A (`token-A`) for this student, then drive the account to `locked` via 5 failed logins (per `002`).
   - **Expect**: both `device_registrations` rows (A and B) are now removed.
2. Log in fresh (after a `003` password reset unlocks the account) on two devices again, then use `007`'s `POST /me/change-password` identifying device A as "current" (via its `refresh_token`).
   - **Expect**: device B's registration is removed; device A's remains.

## Pass/Fail

Any deviation — especially a notification failure ever affecting in-app pickup-code availability (Scenario 3), a logged-out device continuing to receive notifications (Scenario 4), or a locked/password-changed account's other-device registrations surviving (Scenario 5) — is a blocking failure per SC-002/SC-004 and must not ship.
