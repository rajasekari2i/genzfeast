# Feature Specification: Order OTP & Ready-for-Pickup Push Notifications

**Feature Branch**: `009-order-fcm-push-notifications`

**Created**: 2026-09-05

**Status**: Draft

**Input**: User description: "GenzFeast is a multi-tenant (multi-company) mobile food ordering platform that connects college canteens (\"companies\"/tenants) with students on their campus. Each canteen operates as an independent tenant with its own staff, products, and orders, while a central System Admin governs onboarding and platform-wide oversight. Analyse the BRD, PRD, Architecture, and UI Design docs and spec Order OTP and \"your order is ready\" push notifications using Firebase Cloud Messaging."

**Scope note**: This closes a gap identified against `docs/architecture/04-Architecture.md` §8, which names three Firebase Cloud Messaging use cases; only the forgot-password OTP push (`003-forgot-password-otp-reset`) was previously specified. This feature covers the other two — which turn out to be the same event in this platform's order lifecycle (see Assumptions) — and, because nothing yet specifies *how* the backend knows which device to notify, also establishes the device-registration mechanism as shared infrastructure. It does not modify `006-student-browse-cart-checkout` (which already owns the `Order` entity and guarantees in-app OTP display regardless of notification delivery) or `003`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A Device Registers to Receive Notifications (Priority: P1)

While a student is logged in, their device registers itself so the platform knows where to deliver a push notification for their account.

**Why this priority**: This is the enabling capability every other story in this feature depends on — without it, there is no destination to send a notification to.

**Independent Test**: Can be fully tested by having a logged-in student's device register its notification token and confirming the platform stores it, associated with that account and that specific device.

**Acceptance Scenarios**:

1. **Given** a logged-in student, **When** their device registers its notification token, **Then** the platform stores it, associated with their account.
2. **Given** a student logged in on two different devices, **When** each device registers its own token, **Then** both are stored independently, and neither replaces the other.
3. **Given** a device token that's already registered, **When** the same device registers again (e.g., the token was refreshed by the platform's push service), **Then** the stored registration is updated rather than duplicated.

---

### User Story 2 - Student Receives a Push Notification When Their Order Is Confirmed (Priority: P1)

The moment a student's payment succeeds and their order is confirmed and ready for pickup, they receive a push notification announcing it and containing their pickup code — even if the app isn't open.

**Why this priority**: This is the actual value this feature delivers — closing the gap between "order confirmed" and the student finding out, without requiring them to keep the app open and watching.

**Independent Test**: Can be fully tested by simulating a successful payment for an order (per `006-student-browse-cart-checkout`) and confirming a push notification is sent to every one of that student's registered devices, containing the order's pickup code.

**Acceptance Scenarios**:

1. **Given** a student's order transitions from payment-pending to confirmed (payment succeeded), **When** that transition completes, **Then** a push notification is sent to every device currently registered for that student, announcing the order is ready for pickup and including its pickup code.
2. **Given** a student registered on two devices, **When** their order is confirmed, **Then** both devices receive the notification.
3. **Given** a notification fails to deliver to a device (e.g., the device is offline or its registration has become stale), **When** that happens, **Then** the student can still find their pickup code by opening the app, exactly as already guaranteed by `006-student-browse-cart-checkout` — this feature adds a notification channel, it never becomes the *only* way to see the code.

---

### User Story 3 - Tapping the Notification Opens the Order (Priority: P2)

A student who taps the notification is taken directly to that specific order's detail, rather than just to wherever the app happens to open.

**Why this priority**: A meaningful convenience refinement on top of Story 2's core value, but the notification is still useful (the student can always navigate to My Orders manually) without this.

**Independent Test**: Can be fully tested by tapping a delivered order-confirmation notification and confirming the app opens directly to that order's detail view.

**Acceptance Scenarios**:

1. **Given** a delivered order-confirmation notification, **When** the student taps it, **Then** the app opens directly to that order's detail view.

---

### User Story 4 - A Device Stops Receiving Notifications After Logout (Priority: P2)

Once a student logs out of a device (or that session ends via account lock or a password change, per the platform's existing session rules), that device no longer receives push notifications intended for that account.

**Why this priority**: A privacy/correctness safeguard — without it, a shared or previously-used device could keep receiving another person's order notifications indefinitely. It's a refinement on the registration mechanism (Story 1), not a blocker to demonstrating the core notification flow.

**Independent Test**: Can be fully tested by registering a device's token, logging that session out, and confirming a subsequent order confirmation for that account is no longer sent to that device's token.

**Acceptance Scenarios**:

1. **Given** a device registered for a student's account, **When** that session logs out, **Then** the device's registration is removed.
2. **Given** an account whose session ends via lock (`002-registration-login-jwt-auth`) or a password change (`002`/`007-user-profile-management`), **When** that happens, **Then** the affected device's registration is removed the same way as an explicit logout.
3. **Given** a device whose registration was removed, **When** that account's order is later confirmed, **Then** no notification is sent to that device.

---

### Edge Cases

- What happens when a student has no registered devices at all (e.g., notification permission was denied) at the moment their order is confirmed? (No notification is sent to anyone; the student still sees the pickup code in-app, unaffected — per Story 2, Scenario 3.)
- What happens if the same device token is somehow registered for two different accounts (e.g., one account logged out and another logged in on a shared device without the first properly logging out first)? (The most recent registration for that token wins — a token can only ever be associated with one account at a time; registering it under a new account implicitly supersedes any prior association.)
- What happens to a device's registration if the app is uninstalled without the student ever logging out? (Out of this feature's control — the platform's push provider will eventually report the token as invalid on a failed send; no proactive detection is required in V1.)
- How does this feature avoid ever sending a duplicate notification for the same order confirmation (e.g., if the underlying payment confirmation is itself retried/replayed, per `006`'s own idempotency handling)? (It doesn't need its own separate safeguard — it is only triggered by the transition itself, and `006` already guarantees that transition happens at most once per order.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a logged-in user's device to register the token needed to deliver push notifications specifically to that device.
- **FR-002**: System MUST support a single user having more than one currently registered device at once, without one registration replacing another.
- **FR-003**: Re-registering the same device's token MUST update the existing registration rather than create a duplicate.
- **FR-004**: Upon an order's payment succeeding and the order becoming confirmed/ready for pickup, System MUST send a push notification to every one of that student's currently registered devices, announcing the order is ready and including its pickup code.
- **FR-005**: System MUST NOT send this notification for any other order transition (its creation while payment is still pending, a failed payment, or its eventual pickup/delivery) — only the transition into confirmed/ready-for-pickup triggers it.
- **FR-006**: A failure or delay in delivering this notification MUST NOT prevent the student from finding their pickup code in-app — the code's in-app availability (already guaranteed by `006-student-browse-cart-checkout`) MUST remain completely unaffected by whether the notification succeeds.
- **FR-007**: Tapping a delivered order-confirmation notification MUST take the student directly to that specific order's detail view.
- **FR-008**: System MUST remove a device's registration when that device's session ends — whether via explicit logout, the account becoming locked, or a successful password change (per `002-registration-login-jwt-auth`'s and `007-user-profile-management`'s existing session-ending rules) — so it no longer receives notifications for that account afterward.
- **FR-009**: System MUST prevent a device's registration from being used to notify, or being associated with, any account other than the one that most recently registered it.
- **FR-010**: System MUST record each notification attempt's outcome (sent, or failed and why) in a manner that supports later operational troubleshooting, consistent with the platform's general auditability requirements.

### Key Entities

- **Device Registration**: A record linking one user's account to one specific device/app-installation's push-notification token, so the platform knows where to deliver a notification for that account. A user may have several active registrations at once (one per device); a registration is removed when its session ends.
- **Order-Ready Notification**: The specific push message sent the moment an order transitions to confirmed/ready-for-pickup, carrying the order's pickup code and a ready-for-pickup announcement — this feature's only notification type.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A student whose payment just succeeded receives a push notification on every device where they're currently logged in, without needing the app open at that moment.
- **SC-002**: 100% of students can still locate their pickup code in-app even when notification delivery fails entirely for every one of their devices.
- **SC-003**: Tapping the notification takes the student to the correct order's detail in a single action.
- **SC-004**: 100% of device registrations are removed at the moment their session ends (logout, lock, or password change) — zero cases of a notification being sent to a device no longer associated with an active session for that account.

## Assumptions

- **"Order OTP" and "your order is ready" are the same event in this platform**: The Architecture document names these as if they might be distinct, but this platform's order lifecycle (`payment_pending` → `order_placed` → `delivered`, per `006`) has no separate "being prepared" state between payment success and pickup-readiness — a canteen counter order is ready to hand over the moment it's paid for. A single notification, sent at that one transition, serves both purposes at once.
- **Best-effort delivery, no retry queue**: Consistent with the precedent already set for the forgot-password OTP push (`003-forgot-password-otp-reset`), a single delivery attempt is made per device; delivery is not guaranteed and does not need to be, since the in-app fallback (`006`) is always authoritative and always available regardless.
- **No in-app notification history/inbox**: Nothing in the UI Design document calls for a screen listing past notifications; a notification is a transient, in-the-moment prompt only.
- **Shared infrastructure, not a change to `003`**: The device-registration mechanism this feature establishes is reusable by `003`'s already-specified (but previously under-specified on this exact point) forgot-password OTP push. This spec does not modify `003`'s requirements — it only makes the missing "how does the backend know which device to push to" piece exist for the platform as a whole.
- **Registration trigger is a client-side implementation detail**: Exactly when a device (re-)registers its token (every login, every app foreground, on token-refresh callback from the push provider, etc.) is left to the planning phase; this spec only requires that a logged-in device's current token is kept up to date.
