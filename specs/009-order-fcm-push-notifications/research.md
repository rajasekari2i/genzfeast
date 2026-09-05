# Phase 0 Research: Order OTP & Ready-for-Pickup Push Notifications

**Feature**: `009-order-fcm-push-notifications` | **Date**: 2026-09-05

Depends on `002-registration-login-jwt-auth` (sessions/refresh tokens), `006-student-browse-cart-checkout` (the `orders` table and its payment webhook), and `005-staff-order-fulfilment-otp`'s `order_audit_logs` table (extended here, not owned). This document resolves the implementation-pattern unknowns for device registration and notification delivery.

## 1. Device registration table and its link to a specific session

- **Decision**: A new `device_registrations` table: `id`, `user_id`, `fcm_token` (unique), `refresh_token_id` (references `refresh_tokens(id)` from `002`), `created_at`, `updated_at`. The registration endpoint requires the caller to also submit their own current `refresh_token` in the request body — the same self-identification pattern `002`'s `/auth/logout` and `007`'s `/me/change-password` already use, since (per `007`'s research.md §2) an access token's claims carry no session/refresh-token identifier on their own.
- **Rationale**: FR-008 requires removing "that device's" registration when "that device's session" ends — which is a per-session, not per-user, action. Without a link back to the specific `refresh_token_id`, there would be no way to know which single registration to remove on one specific logout (as opposed to either removing none of them, or over-broadly removing every registration the user has). Requiring `refresh_token` at registration time costs nothing extra for the client — it already has that value from login/refresh.
- **Alternatives considered**: No session link, keyed only by `user_id` — rejected, since it makes FR-008's per-device removal impossible to implement precisely (logging out one device would either have to remove nothing or remove every device's registration, both wrong).

## 2. Upsert semantics — one token, one owner

- **Decision**: `fcm_token` is the table's unique key. Registering an already-known token is an `UPSERT`: `user_id`, `refresh_token_id`, and `updated_at` are overwritten to the new values. This directly implements both FR-003 (re-registration updates, doesn't duplicate) and the Edge Case resolution (a token registered under a new account supersedes its prior association).
- **Rationale**: A physical device's FCM token genuinely can only ever point to one app installation at a time; letting the same token exist under two different `user_id`s simultaneously would risk delivering one student's order notification to whoever last logged out of that device.
- **Alternatives considered**: A composite key of `(user_id, fcm_token)`, allowing the same token to appear under multiple users — rejected; this is exactly the stale-shared-device scenario the Edge Case explicitly wants resolved by "most recent registration wins," not preserved as multiple simultaneous associations.

## 3. Cascading registration removal from `002`/`007`'s existing session-ending events

- **Decision**: Extend the session-revocation code paths that already exist:
  - `002`'s `/auth/logout` (revokes one `refresh_token`) additionally deletes any `device_registrations` row with that same `refresh_token_id`.
  - `002`'s account-lock flow (revokes *all* of a user's refresh tokens) additionally deletes every `device_registrations` row for that `user_id`.
  - `007`'s change-password flow (revokes every refresh token except the one identified as "current") additionally deletes every `device_registrations` row whose `refresh_token_id` is among the ones just revoked — leaving the current device's registration untouched, mirroring exactly which sessions survive.
- **Rationale**: This is a straightforward extension of logic those features already have — "revoke this set of refresh token ids" and "also delete device_registrations referencing those same ids" are the same operation shape, just touching a second table. No new revocation *concept* is introduced.
- **Alternatives considered**: A time-based expiry on `device_registrations` instead of explicit cascading deletes — rejected; it would leave a stale registration live for its entire expiry window after a logout, directly undermining FR-008/SC-004's "zero cases" bar.

## 4. Sending the notification — hooking into `006`'s existing payment webhook

- **Decision**: The order-confirmation push is sent from inside `006`'s payment-webhook handler, at the exact point it sets `status = 'order_placed'` — not as a separate polling job or a database trigger. It looks up every `device_registrations` row for the order's `user_id` and calls the Firebase Admin SDK once per token.
- **Rationale**: `006`'s webhook is already the single, idempotent place this transition happens exactly once (research.md §5 there) — piggybacking on it means this feature inherits that idempotency for free (Edge Cases: "no separate safeguard needed... `006` already guarantees the transition happens at most once per order") rather than needing to invent its own dedup mechanism.
- **Alternatives considered**: A database trigger on `orders` (`AFTER UPDATE ... WHEN status changed to order_placed`) that enqueues a notification job — rejected as unnecessary indirection for a feature with no other need for an async job queue; a direct call from the same request that already owns the transaction is simpler and is sufficient, given FCM sends are fire-and-forget/best-effort (research.md §5, Assumptions).

## 5. Delivery is best-effort — failures are logged, not retried

- **Decision**: Each FCM send attempt (one per registered device) is fire-and-forget from the webhook handler's perspective: its outcome (success or the provider's failure reason, e.g. an invalid/unregistered token) is written to `005`'s existing `order_audit_logs` table under two new event types, `order_ready_notification_sent` and `order_ready_notification_failed` — and nothing about the webhook's own success/response depends on the notification's outcome.
- **Rationale**: Matches the spec's own Assumption (best-effort, no retry queue, consistent with `003`'s precedent) and reuses `order_audit_logs` (already the right shape for "an order-lifecycle-adjacent event that isn't itself a row mutation") rather than introducing a third audit table for what is, at its core, the same kind of event `005` already built that table for.
- **Alternatives considered**: A retry queue with exponential backoff for failed sends — rejected as unrequested scope; the in-app fallback (`006`) makes delivery reliability a nice-to-have, not a correctness requirement, so the added complexity isn't justified.

## 6. Deep-linking the notification to its order

- **Decision**: The FCM message carries a small data payload (`{"order_id": "<uuid>"}`) alongside its display text; the mobile client's notification-tap handler reads that payload and navigates directly to `OrderDetail` for that id (the same screen `006`/`008` already built).
- **Rationale**: Standard FCM data-payload pattern; no new screen or endpoint is needed — this feature only needs to make sure the right identifier rides along with the notification.
- **Alternatives considered**: A deep-link URL scheme instead of a raw data payload — equivalent in effect for a single, already-authenticated mobile app; the plain data payload is simpler for a first version.

## Outstanding NEEDS CLARIFICATION

None. The spec shipped with zero clarification markers.
