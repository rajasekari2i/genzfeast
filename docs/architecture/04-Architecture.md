# Architecture Document (v2)
## GenzFeast — Multi-Tenant Food Ordering Platform

> **Change from v1:** Database moved from Firebase/Firestore to **Supabase (managed PostgreSQL)**. **Firebase is retained only for Cloud Messaging (push notifications).** Authentication moved to **stateless JWT** issued by the Node.js backend, with a revocable refresh-token layer.

## 1. Tech Stack

| Layer | Technology |
|---|---|
| Mobile client | React Native (single codebase, multiple tenant build flavors) |
| Backend API | Node.js (Express/NestJS) |
| Database | **Supabase — managed PostgreSQL** |
| File storage | **Supabase Storage** (product images) |
| Auth | **Stateless JWT**, issued and verified by the Node.js backend (not Supabase Auth, not Firebase Auth) |
| Push notifications | **Firebase Cloud Messaging (FCM) only** — no other Firebase product is used |
| Payments | Razorpay (UPI-restricted checkout), server-verified via webhook |
| Hosting (API) | Cloud Run / any Node-compatible host |

## 2. Why Supabase / PostgreSQL

The product's own data model (`companies → users → orders`, `roles`, `categories`, `departments`, `deliveries`) is genuinely relational, with real foreign keys and cross-entity queries (e.g., "all orders for a company with a given status," "a student's own orders joined with product names"). PostgreSQL supports this natively — with joins, transactions, and Row Level Security — instead of requiring the manual denormalization and 500-document transaction limits that a document database like Firestore would impose. Supabase also gives more predictable, flat-rate pricing at higher read volumes than a pay-per-read NoSQL model, which matters for a polling-heavy app (product lists, order status, staff queues) across many tenants.

## 3. Why Firebase Is Kept — Scoped to One Job

Firebase Cloud Messaging is a standalone service and does not require Firestore or Firebase Auth to function. GenzFeast uses **only** FCM, for:
- Order OTP push notifications
- Forgot-password OTP push notifications
- Order status update notifications (e.g., "your order is ready")

No other Firebase product (Firestore, Firebase Auth, Firebase Storage) is part of this architecture. This keeps the notification layer best-in-class and free, without coupling the core database or auth system to Google's platform.

## 4. Authentication: Stateless JWT

### 4.1 Design

- On successful login, the Node.js backend issues:
  - A short-lived **access token** (JWT, e.g., 15–60 minutes), signed with a backend secret (or asymmetric key pair for future multi-service verification). Claims: `sub` (user id), `role`, `company_id`, `iat`, `exp`.
  - A longer-lived **refresh token** (e.g., 7–30 days), which is a random opaque string. Its SHA-256 hash is stored in the `refresh_tokens` table (see Data Model §9); the raw token is sent to the client only once and never persisted server-side.
- The access token is **stateless**: every API request is authenticated purely by verifying the JWT signature and expiry — **no database lookup is needed to validate an access token.** This keeps request latency low and avoids a session store.
- The refresh token is **not** fully stateless by design: it is tracked in the database so that logout, "log out of all devices," and forced revocation (e.g., suspected compromise, account lock) remain possible. A purely stateless refresh scheme cannot support revocation, which conflicts with the product's own `no_of_login_attempt`/account-lock requirements (PRD FR-4, FR-5) — so this hybrid is a deliberate, documented trade-off, not an oversight.

### 4.2 Token flow

```
Login success
  → issue access_token (JWT, short-lived) + refresh_token (opaque, DB-tracked)
  → client stores both securely (Keychain/Keystore, not plain AsyncStorage)

Each API request
  → client sends access_token in Authorization: Bearer header
  → backend middleware verifies signature + expiry only (no DB hit)
  → backend extracts { sub, role, company_id } claims for authorization + RLS scoping (see §6)

Access token expired
  → client calls /auth/refresh with the refresh_token
  → backend checks refresh_tokens table: not revoked, not expired
  → issues a new access_token (+ optionally rotates the refresh_token, marking the old one
    revoked_at / replaced_by the new one — recommended to detect token theft)

Logout / forced revocation
  → backend sets revoked_at on the relevant refresh_tokens row(s)
  → access tokens already issued remain valid until they naturally expire (this is the
    accepted trade-off of statelessness — keep access-token lifetime short to bound this window)
```

### 4.3 Password reset / account lock interaction

- `no_of_login_attempt` and `status = 'locked'` (Data Model §5) are checked by the login endpoint **before** issuing any token — this is unaffected by the JWT being stateless, since the check happens at token-issuance time, not on every subsequent request.
- A locked or deactivated account's existing refresh tokens should be proactively revoked (set `revoked_at`) as part of the lock action, so a still-valid refresh token cannot mint new access tokens for a locked user.

## 5. High-Level Component Diagram

```
                        ┌────────────────────────┐
                        │   System Admin Portal   │  (internal, web or app)
                        └───────────┬─────────────┘
                                    │ REST/HTTPS (JWT-authenticated)
                                    ▼
 ┌───────────────┐        ┌─────────────────────┐        ┌────────────────────┐
 │ Tenant Admin & │        │                     │        │                    │
 │ Staff App      │◄──────►│   Node.js API       │◄──────►│  Supabase Postgres │
 │ (React Native) │  HTTPS │   (Express/NestJS)  │        │  (multi-tenant DB, │
 └───────────────┘        │                     │        │   RLS enabled)     │
                          │  - JWT verify/issue  │        └────────────────────┘
 ┌───────────────┐        │  - Tenant scoping    │        ┌────────────────────┐
 │ Student App    │◄──────►│  - Order/Payment     │◄──────►│  Supabase Storage  │
 │ (React Native, │  HTTPS │    orchestration     │        │  (product images)  │
 │  per-tenant    │        │  - OTP generation    │        └────────────────────┘
 │  build)        │        └──────────┬───────────┘
 └───────────────┘                    │
                                       ├──────────────► Firebase Cloud Messaging (OTP / status push ONLY)
                                       │
                                       └──────────────► Razorpay (UPI-restricted checkout + webhook)
```

## 6. Multi-Tenant Isolation Strategy

1. **JWT claims**: `role` and `company_id` are embedded in every access token at issuance (§4.1) and never trusted from client-supplied request bodies.
2. **Backend middleware**: every API request resolves `company_id`/`role` from the verified JWT and injects them into every DB query/filter.
3. **Postgres session variables + RLS**: for each request/transaction, the backend runs `SET LOCAL app.current_company_id = ...; SET LOCAL app.current_role = ...; SET LOCAL app.current_user_id = ...;` before querying. Row Level Security policies (Data Model §12) re-check tenant scoping at the database layer — defense-in-depth even if an application-layer bug omits a `WHERE company_id = ...` clause.
4. **System Admin bypass**: the `system_admin` role (no `company_id` claim, or a sentinel value) is allowed cross-tenant access only on `companies` and for provisioning the first Company Admin, per the RLS policies in Data Model §12.

## 7. Order & Payment Sequence

```
Student App        Node API              Razorpay (UPI)         Supabase Postgres
    │  place order     │                        │                     │
    ├──────────────────►                        │                     │
    │                  ├── create order (payment_pending) ────────────►│
    │                  ├── init payment session (UPI-only) ─►          │
    │  ◄───────────────┤   redirect/UPI intent   │                     │
    │  pay via UPI app │                        │                     │
    ├──────────────────────────────────────────►│                     │
    │                  │      webhook (server-to-server, success/failure)
    │                  │◄───────────────────────┤                     │
    │                  ├── verify signature ─────                     │
    │                  ├── update order status + generate OTP ────────►│
    │                  ├── write audit_logs row (order status change) ►│
    │  poll/callback    │                        │                     │
    │◄─────────────────┤ order status + OTP     │                     │
```

**Critical design rule (unchanged from v1):** order status is only ever finalized by the **server-side webhook**, never purely by the client-side redirect, so a closed app or dropped connection cannot leave an order incorrectly stuck or falsely marked successful. Every status transition also writes an `audit_logs` row automatically via the Postgres trigger (Data Model §10), giving a full, tamper-evident history of the payment lifecycle without extra application code.

## 8. Notification Flow (OTP) — via FCM only

- **Password reset OTP** (alphanumeric): generated by backend → stored in `users.reset_password_otp` + `reset_password_otp_expires_at` (Postgres) → sent via **FCM** push → also shown as an in-app fallback (implementation detail, Modules doc).
- **Order OTP** (numeric): generated on payment success → stored in `orders.otp` (Postgres) → pushed via **FCM** and always visible on the order confirmation screen, since pickup at a physical counter should not depend on a notification having been received.

Firebase project setup for this architecture only requires enabling **Cloud Messaging** — no Firestore database, no Firebase Authentication, no Firebase Storage buckets are provisioned.

## 9. Environments & Deployment

| Environment | Supabase Project | Firebase Project (FCM only) | Purpose |
|---|---|---|---|
| `dev` | `genzfeast-dev` | `genzfeast-dev-fcm` | Active development |
| `staging` | `genzfeast-staging` | `genzfeast-staging-fcm` | Pre-release QA, tenant onboarding rehearsal |
| `prod` | `genzfeast-prod` | `genzfeast-prod-fcm` | Live tenants |

- Node.js API deployed as a containerized service (Cloud Run or equivalent), environment-parameterized (no hardcoded secrets — use a secret manager for JWT signing keys, Supabase service-role key, Razorpay keys, FCM server key).
- Mobile builds: one CI pipeline per environment × per tenant flavor, parameterized by `TENANT_ID`/`company_id` and branding assets (unchanged from v1).

## 10. Non-Functional / Cross-Cutting Concerns

| Concern | Approach |
|---|---|
| Security | Password hashing (bcrypt/argon2), OTP expiry, server-only OTP writes, Postgres RLS, short-lived JWT access tokens, revocable refresh tokens, HTTPS everywhere |
| Scalability | Stateless Node API instances behind autoscaling; Postgres connection pooling (e.g., Supabase's built-in pooler/PgBouncer) since RLS + `SET LOCAL` requires transaction-scoped connections |
| Auditability | Automatic `audit_logs` entries on every mutation of business-critical tables (Data Model §10) — no reliance on application code remembering to log |
| Observability | Structured logs per `company_id` + `order_id`; alert on webhook failures, payment mismatches, and refresh-token reuse (a strong signal of token theft) |
| Testing | Contract tests for payment webhook handling (success/failure/duplicate delivery); JWT expiry/refresh-rotation test cases |
| Spec-driven build | See §11 |

## 11. Note on Spec-Driven Development (Claude Code / spec-kit)

Unchanged in spirit from v1, updated for the new stack:

1. **Constitution** → this Architecture doc + BRD.
2. **Specify** → PRD (`FR-1` … `FR-9`) + Data Model (now SQL DDL, directly runnable as Supabase migrations).
3. **Plan** → Module documents map 1:1 to implementation phases/agents; each module's "APIs" section should now assume `Authorization: Bearer <JWT>` on every authenticated route.
4. **Tasks** → break each module document's "Screens" and "APIs" sections into implementable tasks; the SQL in Data Model §1–§10 can be handed directly to an agent as the initial Supabase migration.
