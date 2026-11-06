# Architecture Document (v3 — as-built)
## GenzFeast — Multi-Tenant Food Ordering Platform

| | |
|---|---|
| **Version** | 3.0 — reconciled against the implemented codebase |
| **Status** | V1 built and running. Describes the system as it exists, not as originally proposed. |
| **Last reconciled** | 2026-11-06 |
| **Scope of code** | `api/` (NestJS backend) · `mobile/` (React Native client) |

> **Changes from v2.** v2 was written before implementation and proposed Express-or-NestJS, Supabase Storage, and FCM-only OTP delivery. The build settled on **NestJS**, **Railway Bucket** for files, and a **per-Company SMS/push routing** for two of the three OTP flows. Those and other divergences are flagged **[Changed]** below. §13 is new: it records what a browser-based client would need, since none exists yet.

---

## 1. Tech Stack (as built)

| Layer | Technology | Notes |
|---|---|---|
| Mobile client | **React Native 0.86.3 (bare CLI, not Expo)**, TypeScript 5.9, React 19.2 | Android project only — **no `ios/` directory exists** |
| Mobile styling | **NativeWind 4.2** over Tailwind CSS 3.4 | Single token file is the source of truth; see §10 |
| Mobile navigation | React Navigation 7 — drawer + native stack | Role-driven shell; see §10.1 |
| Mobile secure storage | `react-native-keychain` | Access + refresh tokens go in the OS keystore, never plain `AsyncStorage` |
| Mobile API typing | `openapi-typescript` + `openapi-fetch` | Types generated per feature from each spec's `contracts/openapi.yaml` into `mobile/src/api/generated/` |
| Backend API | **NestJS 10 + TypeScript** | **[Changed]** v2 said "Express/NestJS"; NestJS was chosen because DI + Guards + Interceptors map cleanly onto per-request tenant/role scoping |
| ORM | **Prisma 5** | The schema is *not* the full source of truth — RLS policies, triggers, CHECK constraints and partial unique indexes are hand-written into migration SQL |
| Database | **Supabase (managed PostgreSQL)**, RLS enabled | |
| File storage | **Railway Bucket (S3-compatible)** via `@aws-sdk/client-s3` | **[Changed]** from Supabase Storage. Private bucket; served through an API proxy route |
| Auth | **Stateless JWT (HS256)** issued/verified by this API + DB-tracked revocable refresh tokens | Not Supabase Auth, not Firebase Auth, not cookies |
| Password hashing | **Argon2id** (`argon2`) | One shared `PasswordService` used by every path that ever hashes a password |
| Push | **Firebase Cloud Messaging only** (`firebase-admin`) | No Firestore, no Firebase Auth, no Firebase Storage |
| SMS | **MSG91** (TRAI DLT templates) | Registration verification + per-Company forgot-password |
| Payments | **Razorpay**, UPI-only, server-verified by webhook | |
| Config validation | **Zod** schema validated at boot | A missing *required* variable fails startup; integrations are optional |
| Hosting | Any Node-compatible container host (Cloud Run or equivalent) | |

## 2. Why PostgreSQL

The domain is genuinely relational — `companies → users → orders`, plus `roles`, `categories`, `departments`, `deliveries`, `payment_attempts`, `feedback` — with real foreign keys and cross-entity queries. PostgreSQL gives joins, transactions, and **Row Level Security** natively, where a document store would force manual denormalization and could not provide a second, independent enforcement layer for tenant isolation. RLS is the specific feature this architecture depends on most: it is what makes an application-layer bug insufficient to leak data across tenants.

## 3. Why Firebase Is Kept — Scoped to One Job

Only **Cloud Messaging** is used, for:
- The order-ready / pickup-code push on payment success.
- Forgot-password code delivery when the Company has `is_sms = false`, and as the fallback when an SMS send fails.
- Mobile-verification code delivery when the Company has `is_sms = false`.

Firebase project setup therefore requires enabling **Cloud Messaging only** — no Firestore database, no Firebase Authentication, no Storage buckets.

**[Changed from v2]** v2 described SMS as a single narrow exception for registration only. The build widened it: forgot-password now also routes per Company via `companies.is_sms`. The **order pickup code remains FCM-only, unconditionally** — it is never sent by SMS, regardless of any flag, because it is always visible in-app anyway.

## 4. Backend Module Map

`api/src/` — one NestJS module per bounded concern.

| Module | Routes | Role guard |
|---|---|---|
| `auth` | `/auth/register/options`, `/auth/register/send-verification`, `/auth/register/verify-mobile`, `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/forgot-password/{request,verify}` | Public except `logout` |
| `companies` | `/admin/companies`, `/admin/companies/:id/admins` | `system_admin` |
| `users` | `/admin/users` · `/tenant/users` (incl. `/:id/status`, `/:id/role`) | `system_admin` · `company_admin` |
| `categories` | `/tenant/categories` | read: admin/staff/student · write: `company_admin` |
| `departments` | `/tenant/departments` | read: admin/staff/student · write: `company_admin` |
| `products` | `/tenant/products` (+ `/:id/soldout`, `/:id/image`) · `/products/image/:key` | read: admin/staff · write: `company_admin` · sold-out: admin+staff · image read: **public** |
| `orders` | `/student/products`, `/student/orders` (+ `/:id`, `/:id/retry-payment`) · `/tenant/staff/orders` (+ `/:id`, `/:id/verify`) | `student` · `company_staff` |
| `payments` | `/payments/webhook` | **Unauthenticated** — authenticity comes from the HMAC signature |
| `profile` | `/me/profile`, `/me/change-password` | Any authenticated role |
| `devices` | `/me/devices` | Any authenticated role |
| `contact-us` | `/me/contact-us` | All five tenant roles (explicit allowlist) |
| `feedback` | `/me/feedback` (submit) · `/tenant/feedback` (review/resolve) | Any authenticated role · `company_admin` |
| `notifications` | — | FCM + MSG91 adapters behind a port |
| `common` | — | Guards, interceptor, decorators, Prisma access, config, exception filter |

**Request pipeline:** `JwtAuthGuard` → `RolesGuard` → `TenantContextInterceptor` → controller → service → `TenantPrismaService`. A global `ValidationPipe` runs with `whitelist` + `forbidNonWhitelisted` + `transform`, so an unrecognized request field is a `400`, never silently ignored. A global `HttpExceptionFilter` normalizes error responses.

## 5. Authentication

### 5.1 Design

- **Access token** — JWT, HS256, signed with `JWT_SECRET` (minimum 32 characters, enforced at boot). TTL `JWT_ACCESS_TOKEN_TTL_SECONDS`, **default 1800s (30 min)**. Claims: `sub`, `role`, `company_id` (null for `system_admin`), `iat`, `exp`, `jti`.
- **Refresh token** — opaque random bytes, never a JWT. Only its **SHA-256 hash** is stored, in `refresh_tokens`. TTL `JWT_REFRESH_TOKEN_TTL_DAYS`, **default 14**. The raw value is returned to the client exactly once.
- Access-token verification is **pure signature + expiry — no database round-trip**. This is what keeps per-request latency flat.
- The refresh token is deliberately **not** stateless: logout, password-change session revocation, and account lock all require revocability, which a purely stateless scheme cannot provide.

### 5.2 Token flow

```
Login / Register success
  → access_token (JWT, short-lived) + refresh_token (opaque, SHA-256 hash stored)
  → client stores both in the OS keystore (react-native-keychain)

Each API request
  → Authorization: Bearer <access_token>
  → JwtAuthGuard verifies signature + expiry only (no DB hit) → request.user
  → RolesGuard checks @Roles(...) against request.user.role
  → TenantContextInterceptor maps { sub, role, company_id } → request.tenantContext

Access token expired
  → POST /auth/refresh with the refresh token
  → look up its SHA-256 hash; reject if revoked or expired
  → ROTATE: issue a new pair, set revoked_at + replaced_by on the old row
    (the chain makes reuse of a retired token detectable — a strong theft signal)

Logout / password change / account lock
  → set revoked_at on the relevant refresh_tokens row(s)
  → already-issued access tokens stay valid until natural expiry
    (the accepted statelessness trade-off — bounded by the 30-minute TTL)
```

### 5.3 Account lock interaction

- `no_of_login_attempt` increments on every failed login **and** on every forgot-password request. At `ACCOUNT_LOCK_THRESHOLD` (**default 5**) `status` becomes `locked` and login is refused.
- There is **no time-based unlock**. A successful password reset is the only path back to `active`, and it also resets the counter to 0.
- Every failed login returns one generic `Invalid username or password`, and forgot-password always returns `202` — neither reveals whether an account exists.

## 6. Multi-Tenant Isolation — the load-bearing design

Four layers, each independently sufficient to catch a mistake in the others.

**1 — JWT claims.** `role` and `company_id` are set at token issuance and read only from the verified token. No handler ever takes a tenant id from a request body, path, or query.

**2 — Application query scoping.** Every service filters by `ctx.companyId`, which comes from `TenantContextInterceptor`, which reads only `request.user`.

**3 — A non-privileged database role.** The running API connects **only** as `app_user` — a `LOGIN` role that owns no tables and is not a superuser. This is not a detail: PostgreSQL RLS is bypassed entirely by a superuser or a table owner, so connecting as either would silently disable layer 4. The owner credential (`DATABASE_URL`) is excluded from the application's config schema by design and is used only for migrations and CLI scripts.

**4 — Row Level Security.** Every database operation runs inside a Prisma interactive transaction whose first statement is:

```sql
SELECT set_config('app.current_user_id',     $1, true),
       set_config('app.current_role',        $2, true),
       set_config('app.current_company_id',  $3, true),
       set_config('app.current_system_actor',$4, true);
```

The third argument `true` gives `SET LOCAL` semantics — transaction-local, so a value can never leak across a pooled connection or into another request's transaction. `TenantPrismaService.runInTenantContext()` is the **only** sanctioned database entry point; no service injects `PrismaClient` directly.

**RLS coverage.** 16 tables have RLS enabled: `companies`, `roles`, `categories`, `departments`, `users`, `refresh_tokens`, `auth_audit_logs`, `products`, `device_registrations`, `orders`, `payment_attempts`, `deliveries`, `order_audit_logs`, `audit_logs`, `mobile_verifications`, `feedback`.

**Bypasses are narrow predicates, never `BYPASSRLS`:**
- `system_admin` gets cross-tenant reach through explicit policy predicates (e.g. `companies_system_admin_only`), scoped to the tables and operations it legitimately needs.
- Non-request code paths — the payment webhook, the pre-authentication login lookup, seed scripts — use a **system-actor** context (`app.current_system_actor`) matched by its own named policies (`payment_service_orders`, `auth_service_mobile_verifications`, …) rather than being granted a blanket bypass.
- `audit_logs` is stricter still: `app_user` has **no grants at all** on it, with `UPDATE, DELETE` explicitly revoked as a belt-and-braces guard. Only the `SECURITY DEFINER` trigger can insert. The application has no read path to it either.

## 7. Order & Payment Flow

```
Student App            NestJS API                 Razorpay            PostgreSQL
    │  POST /student/orders   │                       │                    │
    ├────────────────────────►│                       │                    │
    │        │ 1. reject if an unresolved order already exists             │
    │        │ 2. re-read every product; reject deleted/sold-out items     │
    │        │ 3. build the price snapshot SERVER-SIDE                     │
    │                         ├── create gateway order ──►                 │
    │                         │   (outside any DB txn)  │                  │
    │                         ├── INSERT order + payment_attempt + audit ─►│
    │◄────────────────────────┤ order + payment session                    │
    │  UPI payment via Razorpay native SDK            │                    │
    ├────────────────────────────────────────────────►│                    │
    │                         │◄── webhook (server-to-server) ─────────────│
    │                         ├── verify HMAC-SHA256 over RAW BYTES        │
    │                         ├── ignore if this attempt is already resolved│
    │             success ────├── order_placed + payment_status=success    │
    │                         │   + generate the 6-digit pickup code ──────►│
    │                         ├── best-effort FCM "order ready" push       │
    │             failure ────├── payment_failed (only if this is the      │
    │                         │   CURRENT attempt) ────────────────────────►│
    │                         ├── DB trigger writes audit_logs rows ───────►│
```

**Critical design rules, all enforced in code:**

1. **Only the webhook finalizes an order.** No client redirect ever changes order status. A closed app or dropped connection cannot leave an order falsely successful or permanently stuck.
2. **Signature verification uses the raw request bytes.** The app bootstraps with `rawBody: true` specifically for this — verifying against a re-serialized `JSON.stringify(req.body)` would break silently the moment key order or whitespace differed from what Razorpay actually sent.
3. **Prices are never client-supplied.** The place-order request carries only product ids and quantities. The snapshot (`name`, `price`, `line_total`) is built from the server's own product read.
4. **Every payment attempt is a durable row.** `payment_attempts` keeps every gateway reference ever issued, with exactly one `is_current = true` per order (a partial unique index). A late confirmation for a superseded attempt is still correlatable instead of being dropped — this fixed a real defect in the original single-column design.
5. **Redelivered webhook events are idempotent.** An attempt that already has an outcome is ignored.
6. **The network call is outside the transaction.** A gateway round-trip has no business holding a PostgreSQL transaction open.
7. **One unresolved order per diner.** Re-placing returns the existing order rather than creating a duplicate.

## 8. Notification & OTP Routing

Three distinct codes, three distinct rules. Mixing them up is the easiest mistake to make here.

| Code | Format | Storage | Channel | Fallback |
|---|---|---|---|---|
| **Order pickup** | 6-digit numeric | **Plaintext** in `orders.otp` — deliberate: the diner must be able to re-read it until pickup, which a hash makes impossible | **FCM only, always** | Always visible in-app; pickup never depends on the push arriving |
| **Forgot password** | 6-char alphanumeric, ambiguous characters (`0/O`, `1/I/L`) excluded | SHA-256 hash in `users.reset_password_otp` + expiry + attempt counter | **MSG91 SMS if the user's Company has `is_sms = true`, else FCM push** | SMS failure falls back to FCM push |
| **Mobile verification** | 6-digit numeric | SHA-256 hash in `mobile_verifications` (pre-account — no `users` row exists yet) | Same per-Company `is_sms` routing | **None by design** — a send failure is surfaced as an error, because registration can depend on it |

Both user-facing codes are delivered as **visible** notifications the person reads and types in — not silent data pushes with client-side auto-fill.

`NotificationPort` is the seam; `FcmNotificationAdapter` is the real implementation, and a logging no-op adapter is substituted automatically whenever Firebase is unconfigured. MSG91 is injected directly rather than widened into that port, since only two flows use SMS.

**Mobile verification is gated off by default.** `MOBILE_VERIFICATION_REQUIRED` defaults to `false`; registration behaves exactly as before until DLT template approval completes per environment. Each distinct message needs its own DLT-registered template (`MSG91_TEMPLATE_ID_MOBILE_VERIFICATION` vs `MSG91_TEMPLATE_ID_PASSWORD_RESET`) — India's DLT regulation does not permit reusing one template for differently-worded messages.

## 9. File Storage

**[Changed from v2]** Product images live in a **Railway Bucket** (S3-compatible, via `@aws-sdk/client-s3`), not Supabase Storage.

The bucket is **private**. There is no public object URL, so uploads return a URL pointing at this API's own proxy route, `GET /products/image/:key`, built from `PUBLIC_API_BASE_URL`. That route is deliberately unauthenticated so a plain `<Image src>` works without attaching a bearer token. Upload (`POST /tenant/products/:productId/image`) is `company_admin` only and MIME-allowlisted.

Storage is optional at boot: with the bucket unconfigured the API still starts, and only the two image routes fail, at request time.

## 10. Mobile Client Architecture

### 10.1 One app, routed by role

`RootNavigator` branches on session state only: no session → `AuthNavigator`; session → `AppShell`. `AppShell` is a drawer whose items are composed from the `role` claim:

| Role | Drawer items |
|---|---|
| `student` | Home · Cart · My Orders · Profile · Contact Us · Feedback |
| `company_staff` | Incoming Orders · Products · Profile · Contact Us · Feedback |
| `company_admin` | Dashboard · Products · Categories · Departments · Users · Feedback Review · Profile · Contact Us · Feedback |
| `teaching`, `non_teaching` | Profile · Contact Us · Feedback **only** |
| `system_admin` | — never uses this app; it is per-Company and a System Admin has no Company |

Each drawer item mounts its **own** stack instance at a different entry screen, so destinations keep independent back-stacks rather than behaving as tabs into one shared history.

### 10.2 Design system

`mobile/src/theme/tokens.ts` is the single source of truth for every colour, type style, spacing and radius value. No screen or component may hardcode a value the token file already defines.

**The shipped palette is orange, not blue.** `colors.primary = #FF6B35`, `primaryVariant = #183153` (navigation chrome), `accent = #FFC857`, `secondary = #0E9F6E`, `background = #FFF7ED`. This **supersedes** `specs/013-blue-theme-visual-design`, whose directory name is now misleading — only the colour values changed; the token mechanism it introduced is intact.

`colors.primary` is the **only** token a tenant may override, and only at build time through `brand/resolveBrandTheme.ts` (with a contrast check in `brand/contrastCheck.ts`). Every other token is fixed platform-wide.

### 10.3 Build-time tenant configuration

Via `react-native-config`: `COMPANY_ID` (the tenant this build serves), `API_BASE_URL`, `RAZORPAY_KEY_ID` (publishable by design), `RAZORPAY_CONFIG_ID` (the dashboard-saved UPI-only method set). `COMPANY_ID` being a build-time constant is what makes each tenant a separate app build rather than a runtime selection.

### 10.4 Typed API access

Each feature's `contracts/openapi.yaml` is compiled by `openapi-typescript` into `mobile/src/api/generated/<feature>.d.ts`, and consumed through `openapi-fetch`. Request and response shapes are therefore checked against the API contract at compile time. Regenerate with `npm run api:generate`.

## 11. Configuration & Deployment

### 11.1 Boot-time validation

`env.validation.ts` validates all configuration with a Zod schema at startup. The rule is deliberate: **a missing required variable fails startup immediately and never falls back to a default.**

**Required:** `APP_DATABASE_URL`, `JWT_SECRET` (≥32 chars).
**Required with defaults:** `JWT_ACCESS_TOKEN_TTL_SECONDS` (1800), `JWT_REFRESH_TOKEN_TTL_DAYS` (14), `ACCOUNT_LOCK_THRESHOLD` (5), `RESET_PASSWORD_OTP_TTL_MINUTES` (10), `RESET_PASSWORD_OTP_MAX_ATTEMPTS` (5), `MOBILE_VERIFICATION_OTP_TTL_MINUTES` (10), `MOBILE_VERIFICATION_OTP_MAX_ATTEMPTS` (5), `MOBILE_VERIFICATION_REQUIRED` (`false`), `MOBILE_VERIFICATION_RESEND_COOLDOWN_SECONDS` (60), `PORT` (3000).
**Optional by design** — the API boots without them and the dependent request fails clearly instead: `RAILWAY_BUCKET_*`, `PUBLIC_API_BASE_URL`, `FIREBASE_*`, `RAZORPAY_*`, `MSG91_*`.

**Deliberately *excluded* from the schema:** `DATABASE_URL` (migration/CLI only — the running app must never hold the owner credential) and `BOOTSTRAP_ADMIN_*` (read only by the seed script).

### 11.2 Two database credentials

| Variable | Role | Used by |
|---|---|---|
| `DATABASE_URL` | Owner / superuser | `prisma migrate` and CLI scripts only |
| `APP_DATABASE_URL` | `app_user` — `LOGIN`, owns nothing, not superuser | The running API, and RLS tests |

This split is what makes §6 layer 4 real rather than decorative.

### 11.3 Environments

| Environment | Supabase project | Firebase project (FCM only) | Purpose |
|---|---|---|---|
| `dev` | `genzfeast-dev` | `genzfeast-dev-fcm` | Active development |
| `staging` | `genzfeast-staging` | `genzfeast-staging-fcm` | Pre-release QA, onboarding rehearsal |
| `prod` | `genzfeast-prod` | `genzfeast-prod-fcm` | Live tenants |

The API deploys as a container, fully environment-parameterized, with every secret from a secret manager. Each new environment is bootstrapped by `npm run seed:system-admin`, which creates the first System Admin from `BOOTSTRAP_ADMIN_*` and hashes the password transiently — never logging, persisting, or writing it back.

Mobile builds: one pipeline per environment × per tenant flavour, parameterized by `COMPANY_ID` and branding assets.

### 11.4 Connection pooling

RLS depends on `SET LOCAL`, which is transaction-scoped. Pooling must therefore be transaction-mode (Supabase's pooler / PgBouncer), and every query must stay inside the interactive transaction `TenantPrismaService` opens. This is not optional tuning — session-mode pooling with transaction-local settings would be a correctness bug.

## 12. Cross-Cutting Concerns

| Concern | Approach as built |
|---|---|
| **Security** | Argon2id passwords; SHA-256 for refresh tokens and both hashed OTPs; short-lived HS256 access tokens; revocable refresh tokens with a rotation chain; RLS under a non-privileged role; `forbidNonWhitelisted` request validation; no account enumeration on login or forgot-password; HTTPS everywhere |
| **Auditability** | `audit_logs` written by a table-agnostic `SECURITY DEFINER` trigger on `products`, `orders`, `payment_attempts`, `feedback` — the application never writes it. `auth_audit_logs` (login/logout/lock) and `order_audit_logs` (order and fulfilment events, including *failed* code attempts) capture events that are not themselves a row changing. **Caveat:** no API read path exists for any of it |
| **Scalability** | Stateless API instances behind autoscaling; access-token verification needs no database hit; transaction-mode pooling |
| **Observability** | Structured logs keyed by `company_id`/`order_id`. Worth alerting on: webhook signature failures, payment/status mismatches, and refresh-token reuse (a strong theft signal, detectable thanks to the `replaced_by` chain) |
| **Resilience** | Every third-party integration is optional at boot and fails at its own request rather than at startup; push delivery is best-effort and never affects a webhook's response |
| **Testing** | `api/test/{unit,contract,rls}`, `mobile/test`. 80% threshold in `.coverage-thresholds.json` is the blocking gate. **RLS and integration tests must never run against the real Supabase instance** — use a mocked or ephemeral database |

## 13. What a Web Client Would Need *(nothing web exists today)*

No browser-based client exists. These are the concrete, code-level constraints any new website inherits.

| # | Constraint | Detail |
|---|---|---|
| **W1** | **CORS is not enabled.** | `main.ts` never calls `enableCors()`. Every cross-origin browser request is blocked today. This is a prerequisite, not a polish item — and it should be an explicit origin allowlist, not a wildcard, since this API is bearer-token authenticated |
| **W2** | **Bearer tokens, not cookies.** | A browser client must store the access token and the opaque refresh token itself, and implement rotation against `POST /auth/refresh`. There is no cookie-based session and no CSRF machinery, because none was needed for a native client — a cookie-based web session would mean adding both |
| **W3** | **System Admin is the best-served audience.** | `/admin/companies` and `/admin/users` are complete and have **no client at all**. A System Admin console is the lowest-effort, highest-value web surface |
| **W4** | **`system_admin` has `company_id = NULL`.** | Every `/tenant/*` route will reject that role. A console must route by role the way `AppShell` already does |
| **W5** | **No tenant switcher exists.** | Tenancy is a build-time constant on mobile. A web Company Admin console would need a real runtime notion of "which Company am I acting as" — for `system_admin` that is a genuinely new concept, not a port of an existing one |
| **W6** | **Native-only integrations.** | FCM push and the Razorpay **native** SDK have no web equivalent in this codebase. A diner-facing web storefront would need Razorpay's web checkout and either FCM Web Push or no push at all. A back-office console needs neither |
| **W7** | **Product images already work in a browser.** | `GET /products/image/:key` is unauthenticated and returns bytes directly — usable from a plain `<img src>` |
| **W8** | **Contracts are reusable.** | 13 of the 16 specs ship a `contracts/openapi.yaml` (all except 011, 012 and 013, which add no HTTP surface). These can generate a typed web client exactly the way `mobile/src/api/generated/` is produced |
| **W9** | **No rate limiting or request throttling exists.** | The only throttle anywhere is the mobile-verification resend cooldown. A public web origin raises the exposure of `/auth/login` and `/auth/forgot-password/request` noticeably |
| **W10** | **No OpenAPI/Swagger is served at runtime.** | Contracts live as per-feature YAML files in `specs/`, not at an API endpoint |

## 14. Spec-Driven Development

The repository uses **spec-kit** (`.specify/`, `specs/`). V1 was delivered across 16 feature specs, each with `spec.md`, `plan.md`, `research.md`, `data-model.md`, `tasks.md`, and (mostly) `contracts/openapi.yaml`.

| Spec | Feature |
|---|---|
| 001 | Company / Role / Category / Department / User setup |
| 002 | Registration, login, JWT auth |
| 003 | Forgot-password OTP reset |
| 004 | Company Admin product CRUD (+ image storage) |
| 005 | Staff order fulfilment via pickup code |
| 006 | Student browse, cart, checkout |
| 007 | User profile management |
| 008 | My Orders — history & upcoming |
| 009 | Order FCM push notifications |
| 010 | Resume pending order payment |
| 011 | Audit logs — product, order, payment |
| 012 | Bootstrap System Admin seed |
| 013 | Visual design token system *(palette since changed from blue to orange)* |
| 014 | MSG91 SMS OTP mobile verification |
| 015 | Contact Us page |
| 016 | Feedback management |

**Governing constraints.** `.specify/memory/constitution.md` is still an unfilled template; in its absence this Architecture document plus the BRD are the governing constraints for any plan's Constitution Check. `coding_standard.md` at the repository root governs how code is written — in particular §4.3, the Prisma/RLS interaction, which is the single easiest thing to get subtly wrong here.

**For new feature work**, use the spec-kit flow (`/speckit-specify` → `/speckit-plan` → `/speckit-tasks`) so the multi-tenancy, RLS, and audit rules above are re-verified per feature rather than assumed.
