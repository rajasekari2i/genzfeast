# Feature Specification: MSG91 SMS OTP for Registration-Time Mobile Verification

**Feature Branch**: `014-msg91-sms-otp-mobile-verification`

**Created**: 2026-09-11

**Status**: Draft

**Input**: User request: cost-effective tooling for SMS-based mobile-number validation at registration.

## Clarifications

### Session 2026-09-11

- Q: Should this add a new SMS-based mobile-verification flow only, or also replace the existing FCM-push delivery for the password-reset and order-pickup OTP flows (`003-forgot-password-otp-reset`, `009-order-fcm-push-notifications`)? → A: **Add a new flow only.** An earlier draft of this session's work replaced all three OTP flows with SMS and removed FCM entirely — on further clarification, that was corrected: FCM stays exactly as-is for password-reset and order-pickup OTP. SMS (MSG91) is used ONLY for the new registration-time mobile-verification step. `docs/product/01-BRD.md`, `docs/architecture/04-Architecture.md`, and `CLAUDE.md` all document FCM as the unchanged delivery channel for the other two flows, with a narrow, explicit carve-out noting this feature's SMS use.
- Q: Which SMS provider? → A: MSG91. Cost comparison (web research, Sept 2026): MSG91 ~₹0.18–0.25/OTP vs Twilio ~₹0.45/OTP + 2–3% forex surcharge, for an India-only student base. All providers require TRAI DLT template registration regardless of vendor choice — an external, non-code prerequisite.
- Q: Does mobile-number verification block registration completion? → A: Yes, but flag-gated. `MOBILE_VERIFICATION_REQUIRED` (default `false`) lets this ship and merge before DLT template approval completes; ops flips it to `true` only once the MSG91 template is approved and validated.
- Q: OTP code format? → A: Numeric-only (6 digits), matching the pre-existing order-pickup OTP format and standard SMS/Android-Autofill convention — this is a brand-new flow with no prior format to preserve, and it's the one flow actually delivered by SMS in this codebase. (Password-reset's own OTP stays its original 6-character alphanumeric format, unaffected — that flow stays on FCM push, not SMS.)

### Session 2026-09-12

- Q: Should send-verification keep failing hard when MSG91 is unreachable (this session's original 2026-09-11 decision), or fall back to something else? → A: **Fall back to an FCM push, best-effort.** Reversing the 2026-09-11 decision above, on explicit product instruction: when MSG91 send fails, and the mobile client supplied its own device's `fcm_token`, the server now pushes the same code directly to that raw token instead of surfacing an error — no `DeviceRegistration`/`users` row is involved (none exists yet at this point in registration), so this is a new, narrower delivery path, not a reuse of `NotificationPort`'s existing user-keyed sends. A hard error is still surfaced when no `fcm_token` was supplied, or when the push itself also fails. **Important caveat, carried forward from the reasoning above**: SMS proves the phone number is reachable over the telecom network, independent of the app. A push to the registering device's own currently-running app instance only proves that app instance is online — which is already true, since the student is mid-registration in it. This fallback is therefore a materially weaker guarantee than SMS for this flow's stated purpose (proving mobile-number ownership), and is documented as best-effort/degraded, not equivalent — acceptable specifically because it only ever fires when SMS has already failed, not as a routine delivery path.
- Q: Does folding mobile-number verification into the registration screen itself (rather than a separate pre-registration screen) change any of this feature's requirements? → A: No new requirements — this is a client-side UX change (single screen, dynamic button, "Skip for now"/"Resend code" as small links) with no effect on the API contract beyond the new optional `fcm_token` field (FR-007 below). `POST /auth/register/send-verification` and `POST /auth/register/verify-mobile` are unchanged in every other respect.
- Q: Should MSG91 always be attempted first for every Company, with FCM only ever a failure-fallback (FR-006/FR-007), or can a Company opt out of SMS entirely? → A: **Per-Company opt-out.** `specs/001-company-role-user-setup` FR-002a adds `companies.is_sms` (boolean, default `true`, System-Admin-settable via the existing `PATCH /admin/companies/:id`). When `true` (default), behavior is exactly FR-006/FR-007 above — SMS first, FCM only on failure. When `false`, MSG91 is never attempted at all for that Company — FCM push is the primary (not fallback) channel, using the same raw-token mechanism FR-007 already established. This lets a Company avoid MSG91's per-send cost entirely if it chooses to. The resend cooldown (FR-005) stays a single shared limit regardless of channel, since it exists to prevent request spam, not solely to cap SMS billing.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Verify Mobile Number During Registration (Priority: P1)

A prospective student registering for the first time enters their mobile number, receives a one-time SMS code, and enters it to prove the number is really theirs before the rest of registration can complete.

**Why this priority**: Establishes that `users.username` (which doubles as the mobile number) is genuinely reachable at account-creation time.

**Independent Test**: Submit a mobile number to `POST /auth/register/send-verification`, receive a code via MSG91, submit it to `POST /auth/register/verify-mobile`, and confirm a `verification_token` is returned and accepted by `POST /auth/register` (student).

**Acceptance Scenarios**:

1. **Given** a prospective student on the registration flow, **When** they submit a mobile number, **Then** a 6-digit numeric code is sent to that number via SMS (MSG91) and a confirmation is shown.
2. **Given** a just-sent verification code, **When** the student submits the matching code, **Then** the system returns a short-lived opaque `verification_token` tied to that `(company_id, mobile_number)` pair.
3. **Given** a valid, unexpired `verification_token`, **When** the student completes the rest of the registration form and submits `POST /auth/register`, **Then** registration succeeds and the token is consumed (single-use).
4. **Given** `MOBILE_VERIFICATION_REQUIRED=false` (the default, pre-DLT-approval), **When** a student registers without ever calling send-verification/verify-mobile, **Then** registration still succeeds exactly as it did before this feature — this flag gates enforcement, not availability of the new endpoints.
5. **Given** a student requests a second code for the same number within `MOBILE_VERIFICATION_RESEND_COOLDOWN_SECONDS` of the first, **When** they call send-verification again, **Then** the request is rejected with `429 Too Many Requests`, not a duplicate SMS send.
6. **Given** MSG91 is unreachable or misconfigured, **When** a student calls send-verification, **Then** the server falls back to pushing the same code via FCM directly to the mobile client's own device token, if one was supplied — surfacing a distinct "delivered to this device instead" response rather than a false generic "code sent" one; **When** no device token was supplied, or the push also fails, **Then** the request fails with a clear error instead (no silent false-positive either way).

## Requirements *(mandatory)*

- **FR-001**: The system MUST send a 6-digit numeric OTP via MSG91 SMS for registration-time mobile-number-verification requests ONLY.
- **FR-002**: This feature MUST NOT change the delivery channel for password-reset OTP or order-pickup OTP — both stay on Firebase Cloud Messaging (FCM push), unchanged from `003`/`009`.
- **FR-003**: Registration-time mobile verification MUST issue a short-lived, single-use, opaque `verification_token` on successful code verification, consumed atomically with account creation.
- **FR-004**: Registration MUST only require a valid `verification_token` when `MOBILE_VERIFICATION_REQUIRED=true`; the endpoints themselves must exist and function regardless of the flag's value.
- **FR-005**: The mobile-verification send endpoint MUST enforce a per-mobile-number resend cooldown, since it triggers a real, billed SMS send — unlike FCM push, which is free.
- **FR-006**: Mobile-verification code sending MUST attempt a best-effort FCM push fallback (FR-007) when the primary SMS send fails; only when no fallback is possible or the fallback also fails MUST the endpoint surface a distinct error (no silent "code sent" false-positive either way).
- **FR-007**: The send-verification endpoint MUST accept an optional `fcm_token` in its request body. When present and the MSG91 SMS send fails, the system MUST push the same code directly to that token via FCM (a raw-token send, independent of `DeviceRegistration`/`users`, since no account exists yet at this point in registration) and, on success, respond with a message indicating the code was delivered via push rather than SMS.
- **FR-008**: When the requesting Company's `is_sms` (specs/001 FR-002a) is `false`, the system MUST skip MSG91 entirely and deliver the code via the FR-007 FCM push mechanism as the primary channel, not a failure-fallback; when `is_sms` is `true` (the default), behavior is unchanged from FR-006/FR-007.

## Assumptions

- India-only student base — MSG91's DLT-compliant SMS is the delivery mechanism; no international SMS routing is in scope.
- The mobile-verification SMS template requires its own TRAI DLT registration with fixed, pre-approved text — an external process this spec's code changes do not depend on to merge, only to actually deliver in production.
- `users.username` continues to double as the mobile number (no schema change to add a dedicated phone column) — unchanged from `001`/`002`'s existing convention.
- FCM (`firebase-admin`, `DevicesService`/`DevicesModule`/`DeviceRegistration`, `@react-native-firebase/*` on mobile) remains fully in place and unchanged for password-reset/order-pickup — this feature adds a second, narrower notification channel alongside it, not a replacement.
- FR-007's fallback push is the one exception, in this whole codebase, to "every FCM send is keyed by an existing `users` row via `DeviceRegistration`/`DevicesService`": it sends to a raw token supplied directly in the request body, because no user account exists yet at registration time. It does not read or write `device_registrations` at all.
