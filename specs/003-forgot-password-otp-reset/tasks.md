# Tasks: Forgot Password Flow (OTP-Based Reset)

**Input**: Design documents from `/specs/003-forgot-password-otp-reset/` (spec.md, plan.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md)

**Tests**: Included — `plan.md`'s Testing section commits to Jest + Supertest contract tests plus a timing-consistency check for anti-enumeration; tasks below follow that.

**Organization**: Tasks are grouped by user story (spec.md priorities P1/P1/P2/P2), then a Mobile phase, then Polish.

## Dependencies on other modules (blocking — read before starting)

- **`002-registration-login-jwt-auth` is a hard prerequisite**, not yet implemented as of this writing (only its spec/tasks exist — see that feature's issue). This feature's `auth_audit_logs` writes (FR-016) and session-revocation-on-reset (FR-011, via `AuthService.revokeAllSessions`) both reach directly into tables/services `002` creates (`refresh_tokens`, `auth_audit_logs`, `AuthService`, `TokenService`). **US2's and Polish's tasks below cannot be completed until `002`'s Foundational phase (schema/RLS + `AuthAuditService`) and its `revokeAllSessions` helper (`002` tasks T018/T023) exist.** US1's request-side work (OTP generation, in-app fallback) and the `users` column migration are independent of `002` and can proceed first.
- **FCM push delivery is a soft dependency**: no `notifications`/`fcm` module exists in `api/src` yet (that integration is nominally owned by the later `009-order-fcm-push-notifications` module, also not yet built). Per this feature's own User Story 3 / SC-006, the flow is designed to work completely via the in-app fallback code with **zero** push notifications ever arriving — so tasks below implement OTP request/verify fully now and call push delivery through a small `NotificationPort` interface with a no-op/log-only implementation, swapped for a real FCM sender whenever `009` (or an earlier ad-hoc FCM integration) lands. Do not block this feature on FCM being built.
- **`009`'s device-registration path is a soft dependency for FR-017 only**: `009`'s shared `device_registrations` table and its unauthenticated `upsertUnauthenticated(userId, fcmToken)` entry point don't exist until `009` builds them. T005/T006 below accept and forward an optional `fcm_token`, but the actual registration call (FR-017) is a stub/no-op until `009`'s Foundational phase lands — same pattern as the `NotificationPort` seam above, not a blocker for the rest of this feature.
- Builds on `001-company-role-user-setup`'s `users` table (adds 3 columns) — `001`'s Student self-registration endpoint itself is not required for this feature (any existing account, however created, is enough to test against).

## Phase 1: Setup

- [x] T001 Add `reset_password_otp` (text, nullable), `reset_password_otp_expires_at` (timestamptz, nullable), `reset_password_otp_attempts` (integer, default 0) to `User` in `api/prisma/schema.prisma`, and a migration in `api/prisma/migrations/<timestamp>_forgot_password_otp/migration.sql` adding the 3 columns to `users` (data-model.md §1) — no RLS change needed (existing `users` RLS policy already covers these columns)
- [x] T002 [P] Add `RESET_PASSWORD_OTP_TTL_MINUTES` (default `10`) and `RESET_PASSWORD_OTP_MAX_ATTEMPTS` (default `5`) to the env schema in `api/src/common/config/env.validation.ts`, documented in `api/.env.example` (spec.md Assumptions)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The pure OTP-mechanics service every user story depends on.

- [x] T003 Implement `OtpService` in `api/src/auth/otp.service.ts`: `generateCode()` → 6-character alphanumeric string, `hashCode(code)` → SHA-256 hex digest (mirroring `002`'s refresh-token hashing pattern, research.md §1–§2) — pure crypto only, no DB access
- [x] T004 [P] Define a minimal `NotificationPort` interface (`sendPasswordResetCode(userId, code): Promise<void>`) in `api/src/notifications/notification.port.ts` with a `LoggingNotificationAdapter` (logs/no-ops in place of a real push) as the only implementation for now — see "Dependencies" above; `AuthService` depends on the interface, not a concrete FCM client

**Checkpoint**: OTP generation/hashing and the push seam exist — user story work can begin.

---

## Phase 3: User Story 1 - Request a Password Reset OTP (Priority: P1) 🎯 MVP

**Goal**: Any user submits `(company_id, username)` and gets an identical acknowledgment whether or not the account exists; a real account gets a hashed, time-limited code stored and a (currently no-op) push dispatched.

**Independent Test**: Submitting a known username returns the ack and sets `reset_password_otp*` on that row; submitting an unknown username returns byte-identical output with no observable timing difference.

- [x] T005 [P] [US1] `ForgotPasswordRequestDto` (`username`, optional `company_id`, optional `fcm_token`) in `api/src/auth/dto/forgot-password-request.dto.ts` (FR-017)
- [x] T006 [US1] Implement `AuthService.requestPasswordReset(dto)` in `api/src/auth/auth.service.ts`: look up by `(company_id, username)` (or `username` alone for `system_admin`) using the same resolution as `002`'s login (research.md §5); whether or not found, do comparable work on both branches (research.md §5 anti-enumeration timing) — on a match: generate+hash a code via `OtpService`, set `reset_password_otp`/`_expires_at`/`_attempts=0` (superseding any prior outstanding code, FR-014), increment `no_of_login_attempt` (FR-005), call `NotificationPort.sendPasswordResetCode`, and — if `dto.fcm_token` is present — call `009`'s `DevicesService.upsertUnauthenticated(user.id, dto.fcm_token)` (FR-017; stub/no-op until `009` exists, per "Dependencies" above); a `fcm_token` submitted for a username that doesn't resolve is silently ignored — no registration call, no observable difference in the response; always return the identical ack shape regardless
- [x] T007 [US1] `AuthController`: `POST /auth/forgot-password/request` in `api/src/auth/auth.controller.ts`, always `202` with `RequestAck` per contracts/openapi.yaml
- [ ] T008 [P] [US1] Contract tests in `api/test/contract/forgot-password/request.spec.ts`: existing vs. non-existing username produce byte-identical bodies and status; a closed-Company account and a `locked` account both succeed (FR-004, FR-006, SC-002); a username that exists only under a *different* `company_id` is treated as not-found (spec.md Clarifications 2026-09-06); a request including `fcm_token` for a real account results in a device-registration call (mock `009`'s `DevicesService`) while an identical request for a non-existent username never triggers that call, and the response body is byte-identical either way (FR-017)
- [ ] T009 [P] [US1] Timing-consistency check (plan.md Testing) asserting the found/not-found code paths take comparably long — `api/test/contract/forgot-password/timing.spec.ts` (research.md §5)

**Note**: T006/T007 write a `password_reset_requested` `auth_audit_logs` row (FR-016) — that write depends on `002`'s `AuthAuditService`/table existing (see "Dependencies" above); stub/skip the audit call with a `// TODO(002)` if `002` isn't merged yet, but don't ship past code review without it wired.

**Checkpoint**: A user can request a code; the anti-enumeration guarantee is independently verified.

---

## Phase 4: User Story 2 - Verify the Code and Set a New Password (Priority: P1)

**Goal**: Submitting the right code + matching passwords resets the password, clears lockout, and revokes other sessions; a mismatch or bad code changes nothing.

**Independent Test**: Request a code (US1), verify with it + a new password → login with the new password succeeds; a second use of the same code fails.

- [x] T010 [P] [US2] `ForgotPasswordVerifyDto` (`username`, optional `company_id`, `code`, `new_password`, `retype_password`) in `api/src/auth/dto/forgot-password-verify.dto.ts`
- [x] T011 [US2] Implement `AuthService.verifyPasswordReset(dto)` in `api/src/auth/auth.service.ts`: reject immediately if `new_password !== retype_password` (FR-008, no code check performed); otherwise look up the account by `(company_id, username)`, check `reset_password_otp IS NOT NULL AND expires_at > now() AND attempts < MAX` and that `hashCode(code)` matches (data-model.md validity rule) — on mismatch/expired/exhausted, increment `reset_password_otp_attempts` (unless already exhausted) and reject with the single generic error (FR-012, FR-015); on match: update `password_hash` (via `PasswordService`), clear the OTP fields, reset `no_of_login_attempt` to 0 and `status` to `active` if it was `locked` (FR-010), call `AuthService.revokeAllSessions(userId)` from `002` (FR-011)
- [x] T012 [US2] `AuthController`: `POST /auth/forgot-password/verify` in `api/src/auth/auth.controller.ts` mapping to `200`/`400`/`422` per contracts/openapi.yaml
- [ ] T013 [P] [US2] Contract tests in `api/test/contract/forgot-password/verify.spec.ts`: success updates password + unlocks + a subsequent `/auth/login` with the new password succeeds (SC-001); reused code rejected (FR-013); mismatched new/retype rejected with `reset_password_otp_attempts` left untouched (FR-008); wrong code / expired code rejected with the same generic `422` (FR-012); a session active before reset is revoked afterward while the resetting request itself isn't disrupted (FR-011, SC-005)

**Checkpoint**: End-to-end recovery (request → verify → login) works — this is the feature's MVP together with US1.

---

## Phase 5: User Story 3 - See the Code In-App Even Without a Notification (Priority: P2)

**Goal**: The Verify screen shows a usable code with zero dependency on push delivery ever succeeding.

**Independent Test**: Simulate push delivery failing entirely; the code is still obtainable and usable through the app itself.

- [x] T014 [US3] Ensure `NotificationPort.sendPasswordResetCode`'s FCM implementation (once T023 swaps in a real one) sends the code as a **data-message payload**, not (only) a display notification — the app's background message handler is what reads and shows the code (spec.md Clarifications 2026-09-06); confirm `AuthService.requestPasswordReset` (T006) never returns the code in its REST response and that a `NotificationPort` failure/timeout does not fail the request endpoint itself (the code is already persisted regardless of delivery outcome)
- [ ] T015 [P] [US3] Contract test in `api/test/contract/forgot-password/notification-failure.spec.ts`: make `NotificationPort.sendPasswordResetCode` throw/reject and assert `/auth/forgot-password/request` still returns `202` and still persists the code (FR-003, User Story 3)

**Checkpoint**: A push-delivery failure never blocks recovery.

---

## Phase 6: User Story 4 - Expired or Already-Used Codes Cannot Be Reused (Priority: P2)

**Goal**: Old, used, or over-attempted codes are provably dead; a fresh request supersedes any prior outstanding one.

**Independent Test**: Let a code expire / use it once / exceed the attempt limit, then confirm a follow-up attempt (even with the correct code) is rejected; requesting twice invalidates the first.

- [ ] T016 [P] [US4] Contract tests in `api/test/contract/forgot-password/expiry-and-limits.spec.ts`: an expired code is rejected (FR-012); an already-used code is rejected on replay (FR-013); a 6th submission attempt is rejected even with the correct code once the 5-attempt limit was hit on attempt 5 (FR-015); requesting a second code invalidates the first (FR-014); repeated reset requests alone (no failed logins) can drive an account to `locked` via the shared counter (FR-005, Edge Cases)

**Checkpoint**: All four user stories independently pass — quickstart.md Scenarios 1–4 should now all pass.

---

## Phase 7: Mobile (Student surface)

**Goal**: Wire the existing placeholder screens to the real endpoints, matching `002`'s `LoginScreen` wiring pattern (same `company_id`-per-branded-build convention).

- [x] T017 Wire `mobile/src/screens/student/ForgotPasswordRequestScreen.tsx` to `POST /auth/forgot-password/request` (username field + the build's `company_id`, per UI Design §4.3): on success, always navigate to Verify (never branch on account-existence, preserving FR-004 client-side) — `mobile/src/screens/student/ForgotPasswordRequestScreen.tsx`
- [x] T018 Wire `mobile/src/screens/student/ForgotPasswordVerifyScreen.tsx` to `POST /auth/forgot-password/verify` (code, new password, retype password fields per UI Design §4.4): client-side check `new_password === retype_password` before submit (spec.md FR-008 already enforces this server-side too); on `200` success-toast + navigate to Login; on `400`/`422` show the server's error and stay on screen — `mobile/src/screens/student/ForgotPasswordVerifyScreen.tsx`
- [x] T019 Register an FCM background/data-message handler in the mobile app that, on receiving a password-reset push, extracts the code from the message's **data payload** (never its notification/display fields) and pre-fills/shows it on `ForgotPasswordVerifyScreen` if that screen is active — this is User Story 3's actual fallback surface (spec.md Clarifications 2026-09-06): it works whether or not the OS ever surfaced a visible banner, since data messages can be handled silently — `mobile/src/screens/student/ForgotPasswordVerifyScreen.tsx`, plus wherever the app's FCM message handling lives (new, alongside the future `009-order-fcm-push-notifications` setup)

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T020 [P] Extend `api/test/rls/tenant-isolation.spec.ts` to cover the 3 new `users` columns (no new RLS policy needed — confirm the existing per-user/company policy already scopes them correctly)
- [ ] T021 [P] Add `POST /auth/forgot-password/request` and `/verify` requests to `api/postman/GenzFeast-API.postman_collection.json`
- [ ] T022 Run every scenario in `specs/003-forgot-password-otp-reset/quickstart.md` end-to-end once `002` is merged; fix any drift found
- [x] T023 Swap `LoggingNotificationAdapter` (T004) for a real FCM-backed `NotificationPort` implementation once `009-order-fcm-push-notifications` exists — `api/src/notifications/`; at the same time, wire T006's stubbed `DevicesService.upsertUnauthenticated` call to `009`'s real implementation (FR-017)

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)**: blocks every user story.
- **US1 (Phase 3)**: needs Phase 2 only; its own audit-log write needs `002` (noted inline).
- **US2 (Phase 4)**: needs Phase 2 + `002`'s `AuthService.revokeAllSessions` and `auth_audit_logs` — **cannot fully complete until `002` ships its Foundational phase and lockout/session-revocation helper.**
- **US3 (Phase 5)**: needs US1 (T006) to exist; otherwise independent.
- **US4 (Phase 6)**: needs US1 + US2's OTP validity-rule logic (T011) in place; adds no new production code, only tests against it.
- **Mobile (Phase 7)**: needs US1 + US2's endpoints live; T019 needs a human decision first (see note).
- **Polish (Phase 8)**: after all desired stories are done; T023 has no internal blocker, only the external `009` dependency.

### Parallel Opportunities

- Phase 1: T001, T002.
- Phase 2: T003, T004.
- Within each user story phase, `[P]`-marked test files run in parallel once that phase's implementation tasks are done.
- Phase 8: T020, T021 in parallel.

## Implementation Strategy

**MVP first**: Phase 1 → Phase 2 → Phase 3 (US1) → Phase 4 (US2) is the full request→verify→login recovery loop — the two P1 stories — but **US2 is gated on `002`'s Foundational phase landing first** (see Dependencies above). Sequence work so `002`'s Foundational/Login phases are prioritized if both features are being built concurrently.

**Incremental delivery**: add Phase 5 (US3, push-failure resilience) and Phase 6 (US4, expiry/reuse hardening) next, then Phase 7 (mobile wiring, pending the T019 product decision), then Phase 8 (polish, including swapping in real FCM once available).
