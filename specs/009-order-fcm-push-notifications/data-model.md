# Phase 1 Data Model: Order OTP & Ready-for-Pickup Push Notifications

**Feature**: `009-order-fcm-push-notifications` | **Date**: 2026-09-05

Adds one new table, `device_registrations`, on top of `002-registration-login-jwt-auth`'s `refresh_tokens`/`users`. Extends `005-staff-order-fulfilment-otp`'s existing `order_audit_logs` with two new event types. No changes to `006`'s `orders` table.

## Entity Relationship Overview

```
users          (1) ──< device_registrations (many — one per registered device)
refresh_tokens (1) ──0..1 device_registrations  (nullable link, set at registration — research.md §1)
orders         (1) ──< order_audit_logs (many, reused from 005; two new event types here)
```

## 1. `device_registrations`

| Column | Type | Constraints / Notes |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `user_id` | `uuid` | not null, references `users(id)` |
| `fcm_token` | `text` | not null, **unique** — a token can only ever belong to one user at a time (research.md §2) |
| `refresh_token_id` | `uuid` | not null, references `refresh_tokens(id)` — the session that registered this device (research.md §1); used to cascade-delete on that session's logout/revocation |
| `created_at`, `updated_at` | `timestamptz` | not null, default `now()` |

**Constraints**:
- `UNIQUE (fcm_token)` — registering an existing token upserts (`user_id`, `refresh_token_id`, `updated_at` overwritten) rather than creating a second row (FR-003, research.md §2).

**Row Level Security**: scoped by `user_id = current_setting('app.current_user_id', true)::uuid` — a user can only register/see/remove their own device registrations. No `system_admin` bypass (consistent with `004`/`005`/`006`'s precedent of not adding cross-tenant/cross-user access unless a spec explicitly authorizes it — nothing here does).

## Reused, extended: `order_audit_logs` (from `005`) — new `event_type` values

| `event_type` | Written when |
|---|---|
| `order_ready_notification_sent` | An FCM send for a given device succeeds, at the `payment_pending → order_placed` transition (research.md §5) |
| `order_ready_notification_failed` | An FCM send for a given device fails (invalid/unregistered token, provider error, etc.) |

No changes to `order_audit_logs`'s existing columns.

## Cascading deletes (extends existing logic in `002`/`007`, not a schema change)

| Event (already exists) | Additional effect this feature adds |
|---|---|
| `002`: `/auth/logout` revokes one `refresh_token` | Delete `device_registrations` row where `refresh_token_id` matches (research.md §3) |
| `002`: account becomes `locked`, all refresh tokens revoked | Delete every `device_registrations` row for that `user_id` |
| `007`: password change revokes every session except the current one | Delete `device_registrations` rows whose `refresh_token_id` is among the ones just revoked; the current session's registration is untouched |

## Validation Rules Summary (from spec Functional Requirements)

| Rule | Source |
|---|---|
| A device can register its token while logged in | FR-001 |
| A user may have multiple simultaneous registrations | FR-002 |
| Re-registering the same token updates, never duplicates | FR-003 (`UNIQUE(fcm_token)` + upsert) |
| Order-confirmation notification sent to every registered device | FR-004 |
| Only the `payment_pending → order_placed` transition triggers it | FR-005 |
| Notification failure never affects in-app pickup-code availability | FR-006 (enforced structurally — `006`'s webhook response doesn't depend on the notification call) |
| Tapping the notification opens the specific order | FR-007 (client-side, data payload — research.md §6) |
| Registration removed when its session ends | FR-008 (research.md §3) |
| A token is associated with at most one account at a time | FR-009 (`UNIQUE(fcm_token)` + upsert) |
| Every send attempt's outcome is logged | FR-010 |

## State Transitions

`device_registrations` has no internal state machine — a row simply exists (registered) or doesn't (removed via cascade or superseded via upsert). The notification itself is a one-shot side effect of `orders.status` transitioning to `order_placed`, a transition already fully owned and idempotency-guaranteed by `006`.
