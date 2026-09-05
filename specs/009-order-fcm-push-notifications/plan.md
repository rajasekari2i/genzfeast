# Implementation Plan: Order OTP & Ready-for-Pickup Push Notifications

**Branch**: `009-order-fcm-push-notifications` | **Date**: 2026-09-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-order-fcm-push-notifications/spec.md`

## Summary

Close the two remaining Firebase Cloud Messaging use cases Architecture §8 names (order OTP and order-status-update notifications — determined during specification to be the same event in this platform's simple order lifecycle) by: (1) introducing device-token registration as shared infrastructure, linked to a specific session so it can be precisely removed on that session's logout/lock/password-change; and (2) sending a single order-confirmation push, carrying the pickup code, from inside `006`'s existing payment-webhook handler at the exact moment it transitions an order to `order_placed` — inheriting that handler's already-established idempotency for free rather than building a new dedup mechanism. Delivery is best-effort and never gates the order's own success or the in-app pickup-code guarantee `006` already provides.

## Technical Context

**Language/Version**: TypeScript (Node.js 20 LTS) for the API — unchanged from prior features

**Primary Dependencies**: NestJS (reused); `firebase-admin` (Firebase Admin SDK) for sending FCM messages — the first feature to actually need this dependency, though Architecture has referenced FCM as a decided integration since `001`

**Storage**: Supabase-managed PostgreSQL — one new table, `device_registrations` (RLS-enabled, no `system_admin` bypass), plus two new event types on `005`'s existing `order_audit_logs`; no changes to `006`'s `orders` table

**Testing**: Jest + Supertest for `POST /me/devices` (upsert behavior, cross-account token reassignment); a mocked-FCM-client integration test suite covering the webhook-triggered send path (multi-device fan-out, partial failure, total failure never affecting the webhook's own success or the in-app OTP); cascade-deletion tests extending `002`'s logout/lock tests and `007`'s change-password tests

**Target Platform**: Same containerized Node.js API as prior features; mobile client integrates the Firebase SDK for Android/iOS to obtain and refresh its own FCM token (client-side work, not part of this API-focused plan beyond the registration call itself)

**Performance Goals**: The notification send happens inside `006`'s webhook request; per that feature's own NFR, this must not meaningfully slow down webhook processing — FCM sends for a small number of devices per user are fired without blocking the webhook's HTTP response on their completion (fire-and-forget, per research.md §5)

**Constraints**: A notification send's failure or delay MUST NEVER cause the payment webhook itself to fail or delay its response, and MUST NEVER affect the in-app pickup-code guarantee `006` already provides (FR-006); a device's registration MUST be precisely removable per-session, not only per-user (FR-008, research.md §1); a token MUST belong to at most one account at a time (FR-009, `UNIQUE(fcm_token)`)

**Scale/Scope**: Same tenant/user scale as prior features; per-order fan-out is small (a handful of devices per student at most), so no batching/queueing infrastructure is warranted for V1

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

As in prior features, `.specify/memory/constitution.md` remains an unfilled template; `docs/architecture/04-Architecture.md` §3 (Firebase scoped to FCM only) and §8 (Notification Flow) govern this feature directly. Checked against those:

- Uses Firebase Cloud Messaging only — no Firestore, Firebase Auth, or Firebase Storage introduced (Architecture §3's explicit boundary). ✅
- Order OTP remains always visible in-app regardless of notification delivery (Architecture §8, UI Design Design Principle "never hide it behind a notification-only delivery"). ✅
- Notification triggered by the same server-verified transition (`006`'s webhook), not a client-side signal (consistent with Architecture §7's payment-finalization rule, applied here by extension). ✅
- No new cross-tenant or cross-account access introduced — device registrations are strictly own-account, RLS-scoped, no `system_admin` bypass (BRD §9 risk, `004`/`005`/`006` precedent). ✅

**Result**: PASS. No entries required in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/009-order-fcm-push-notifications/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── openapi.yaml      # Phase 1 output (/speckit-plan command)
└── tasks.md               # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

Adds a `notifications/` module; extends `002`'s auth/session code, `007`'s change-password code, and `006`'s payment-webhook handler with additional cascade/send calls.

```text
api/
├── src/
│   ├── notifications/
│   │   ├── devices.controller.ts       # POST /me/devices
│   │   ├── devices.service.ts           # upsert-by-fcm_token, refresh_token_id linkage (research.md §1-§2)
│   │   └── fcm.service.ts                # firebase-admin wrapper: send-to-token, maps provider errors for logging
│   ├── auth/
│   │   └── auth.service.ts               # (002, extended) — logout/lock paths also delete matching device_registrations (research.md §3)
│   ├── profile/
│   │   └── password-change.service.ts    # (007, extended) — revoked-session cleanup also deletes matching device_registrations
│   └── payments/
│       └── payments.service.ts            # (006, extended) — on payment_pending → order_placed, calls fcm.service for every registered device, writes order_audit_logs entries (research.md §4-§5)
├── migrations/
│   └── ...                                 # device_registrations table + RLS (data-model.md)
└── test/
    ├── contract/
    │   └── devices/                         # registration upsert, cross-account reassignment
    └── integration/
        └── order-notifications/              # mocked-FCM fan-out, partial/total failure isolation, cascade-delete-on-logout/lock/password-change

mobile/
└── src/
    └── services/
        └── notifications/
            └── fcmClient.ts                   # obtains/refreshes the device's FCM token, calls POST /me/devices, handles notification-tap deep link to OrderDetail (research.md §6)
```

**Structure Decision**: A new `notifications/` module for the client-facing registration endpoint and the FCM-sending wrapper, kept separate from `payments/` (which only gains a few extra calls into `notifications/fcm.service.ts` rather than owning FCM logic itself) — mirroring `006`'s own precedent of isolating a different trust/integration boundary (there, the webhook's signature-based auth; here, a third-party push provider) into its own module.

## Complexity Tracking

*No Constitution Check violations — this section is intentionally empty.*
