# Product Requirements Document (PRD)
## GenzFeast — V1 (as-built)

| | |
|---|---|
| **Product** | GenzFeast |
| **Version** | 2.0 — **as-built**, reconciled against `api/src` and `mobile/src` |
| **Status** | V1 complete. Every FR below is marked **Built**, **Built (changed)**, or **Not built**. |
| **Last reconciled** | 2026-11-06 |
| **Stack** | React Native 0.86 (bare, Android) + NativeWind 4 · NestJS 10 + TypeScript + Prisma 5 · Supabase (PostgreSQL, RLS) · Railway Bucket (S3-compatible) · Firebase Cloud Messaging · MSG91 SMS · Razorpay (UPI) |

> **How to read this version.** Earlier versions of this PRD were a forward-looking specification. This version is a reconciliation: each requirement carries a status and, where it exists, the endpoint and screen that implement it. Requirements that were specified but never built are kept — marked **Not built** — rather than deleted, so the gap stays visible. §6 records which of the original open questions the code has since answered.

---

## 1. User Roles and Surfaces

| Role | Scope | Description | Surface today |
|---|---|---|---|
| `system_admin` | Platform-wide (`company_id = NULL`) | Onboards Companies and their first Company Admin; manages `company_admin`/`company_staff` accounts across all tenants | **API only — no UI exists** |
| `company_admin` | Own Company (from JWT) | Manages their canteen's users, Categories, Departments, Products, and the Feedback queue | Mobile app |
| `company_staff` | Own Company (from JWT) | Toggles sold-out, fulfils orders by verifying the pickup code | Mobile app |
| `student` | Own Company (from JWT) | Registers, browses, orders, pays, picks up | Mobile app |
| `teaching`, `non_teaching` | Own Company (from JWT) | **Reserved.** Can be created and can log in; reach only Profile, Contact Us, Feedback. No ordering capability. | Mobile app (partial) |

**[Changed from v1.1]** There are **not** three separate applications. There is one React Native app whose post-login drawer is composed from the `role` claim (`mobile/src/navigation/AppShell.tsx`). The "System Admin Portal" named in earlier drafts was never built.

**Per-tenant identity.** Each Company gets its own branded build. `COMPANY_ID` and `API_BASE_URL` are build-time values (`react-native-config`); `colors.primary` is the one theme token a tenant may override. Because `system_admin` has no Company, that role cannot meaningfully use a tenant build at all.

## 2. End-to-End Flow Summary

```
System Admin  → POST /admin/companies            → creates the Company (tenant)
              → POST /admin/companies/:id/admins → creates its first Company Admin
                (both API-only today)

Company Admin → /tenant/categories, /tenant/departments   → master data
              → /tenant/users                             → staff + diner accounts
              → /tenant/products (+ image upload)         → the menu
              → /tenant/feedback                          → review / resolve

Staff         → PATCH /tenant/products/:id/soldout        → stock state
              → GET  /tenant/staff/orders                 → the counter queue

Student       → POST /auth/register/send-verification  (optional, per-Company is_sms)
              → POST /auth/register  or  POST /auth/login
              → GET  /student/products        → browse
              → POST /student/orders          → order created `payment_pending`
                                                 + Razorpay order opened
              → Razorpay UPI checkout (native SDK)
              → POST /payments/webhook  (server-to-server, signature-verified)
                   success → `order_placed`, `payment_status=success`,
                             6-digit pickup code generated, FCM "order ready" push
                   failure → `payment_failed`, "Pay Again" on the SAME order
              → shows the pickup code at the counter

Staff         → POST /tenant/staff/orders/:id/verify  → match → `delivered`
                                                         + Delivery row written
```

## 3. Functional Requirements

### FR-1 — Tenant Onboarding (System Admin) · `admin/companies`, `admin/users`
| # | Requirement | Status | Implementation |
|---|---|---|---|
| FR-1.1 | Create a Company (name, contact person, mobile, email, address) | **Built** | `POST /admin/companies` |
| FR-1.2 | Create that Company's first Company Admin | **Built** | `POST /admin/companies/:companyId/admins` |
| FR-1.3 | View/manage all Companies; set `is_open` and `is_sms`; set free-text operating hours | **Built** | `GET`/`PATCH`/`DELETE /admin/companies[/:id]` |
| FR-1.4 | Manage `company_admin` / `company_staff` accounts in any tenant | **Built** | `GET`/`POST`/`PATCH`/`DELETE /admin/users[/:userId]` |
| FR-1.5 | Platform-wide CRUD over **Roles** | **Not built — by decision** | Roles are a fixed global seeded catalog. The `app_user` database role has no write grant on `roles` at all; only a `SECURITY DEFINER` seeding function may write it. |
| FR-1.6 | Platform-wide CRUD over **Categories / Departments** | **Built (changed)** | These are **tenant-scoped**, owned by each Company Admin via `/tenant/categories` and `/tenant/departments`. There is no cross-tenant master-data endpoint. |

### FR-2 — Tenant Administration (Company Admin) · `tenant/*`
| # | Requirement | Status | Implementation |
|---|---|---|---|
| FR-2.1 | Manage users in own Company: create, edit, change role, activate/deactivate, soft-delete | **Built (changed)** | `/tenant/users` — covers `company_staff`, `student`, `teaching`, `non_teaching` only. A Company Admin **cannot** create or edit a peer `company_admin` (deliberate). Creating a `student` additionally requires `category_id`. |
| FR-2.2 | Manage Category and Department master data | **Built** | `/tenant/categories`, `/tenant/departments` — list/read open to `company_admin`, `company_staff`, `student`; write restricted to `company_admin`. Paginated. |
| FR-2.3 | Manage Products: create, update, soft-delete, toggle sold-out, upload photo | **Built** | `/tenant/products`; `POST /tenant/products/:id/image` (multipart, MIME-allowlisted) |
| FR-2.4 | View/manage the Company's open/closed status; closing stops new orders | **Not built** | `is_open` is System-Admin-editable only, and **nothing checks it at order time**. A closed canteen still accepts orders. See BRD §11 Gap G3. |
| FR-2.5 | **[Added]** Review submitted feedback and mark it resolved | **Built** | `GET /tenant/feedback`, `GET /tenant/feedback/:id`, `PATCH /tenant/feedback/:id/resolve` — `company_admin` only |

### FR-3 — Staff Operations · `tenant/staff/orders`, `tenant/products`
| # | Requirement | Status | Implementation |
|---|---|---|---|
| FR-3.1 | Toggle a product's sold-out flag | **Built** | `PATCH /tenant/products/:id/soldout` — `company_admin` *and* `company_staff` |
| FR-3.2 | View incoming orders (`order_placed`) | **Built** | `GET /tenant/staff/orders` — oldest first (first-in-first-served); `company_staff` only |
| FR-3.3 | Enter the diner's pickup code; on match set `delivered` and write a Delivery record | **Built** | `POST /tenant/staff/orders/:orderId/verify` — the `deliveries.order_id` unique constraint makes double-fulfilment a `409`, not a race |
| FR-3.4 | On mismatch: inline error, no state change, retry allowed | **Built** | The mismatched attempt is still recorded in `order_audit_logs`; the order row is untouched |
| FR-3.5 | **[Added]** Staff never see the pickup code | **Built** | `GET /tenant/staff/orders/:id` deliberately omits it — Staff can only submit a candidate for comparison |
| FR-3.6 | **[Note]** `company_admin` cannot access the Staff order queue | **By design** | Every `/tenant/staff/orders*` route is `@Roles('company_staff')` only |

### FR-4 — Registration & Login · `auth/*`
| # | Requirement | Status | Implementation |
|---|---|---|---|
| FR-4.1 | Register with Name*, Username* (10-digit mobile), Password* (min 8), Email*, **Gender***, Category*, Department (optional) | **Built (changed)** | `POST /auth/register`. `gender` (`male`/`female`/`transgender`) was **added** and is required. `company_id` comes from the build, not user input. |
| FR-4.2 | Dropdown options for the registration form must load before an account exists | **Built** | `GET /auth/register/options?company_id=…` — unauthenticated, returns that Company's Categories and Departments |
| FR-4.3 | Returning users log in with Username + Password | **Built** | `POST /auth/login` (+ `company_id` from the build) |
| FR-4.4 | On successful registration, land on Home — no separate login step | **Built** | Register returns a full session (`201`), same shape as login |
| FR-4.5 | Increment `no_of_login_attempt` on failure; lock the account past a threshold | **Built** | Threshold `ACCOUNT_LOCK_THRESHOLD`, **default 5**. At the threshold `status` becomes `locked` and login is refused. All failures return one generic "Invalid username or password" — the API never reveals whether a username exists. |
| FR-4.6 | Issue a stateless JWT access token + a DB-tracked refresh token; client sends `Authorization: Bearer …` | **Built** | Access token HS256, TTL `JWT_ACCESS_TOKEN_TTL_SECONDS` (**default 1800s**); refresh token is opaque random bytes stored only as a SHA-256 hash, TTL `JWT_REFRESH_TOKEN_TTL_DAYS` (**default 14**). Claims: `sub`, `role`, `company_id`. |
| FR-4.7 | Refresh rotates the token and records the chain | **Built** | `POST /auth/refresh` — the old row gets `revoked_at` + `replaced_by`, so reuse of a retired token is detectable |
| FR-4.8 | Logout revokes the refresh token server-side | **Built** | `POST /auth/logout` (`204`). The already-issued access token stays valid until it expires — the accepted trade-off of statelessness. |
| FR-4.9 | Client stores credentials in the OS keystore, not plain storage | **Built** | `react-native-keychain` |

### FR-5 — Forgot Password · `auth/forgot-password/*`
| # | Requirement | Status | Implementation |
|---|---|---|---|
| FR-5.1 | Request generates a 6-character **alphanumeric** code and increments `no_of_login_attempt` | **Built** | `POST /auth/forgot-password/request` — **always `202`**, whether or not the username exists (no account enumeration). Alphabet excludes `0/O/1/I/L`. Stored only as a SHA-256 hash with an expiry. |
| FR-5.2 | **[Changed]** Delivery channel follows the requesting user's Company `is_sms` flag | **Built** | `is_sms = true` → MSG91 SMS, falling back to FCM push if the SMS send fails. `is_sms = false` → FCM push directly. Either way it is a **visible** message the user reads and types in — not a silent data push with auto-fill. |
| FR-5.3 | Verify screen collects Code + New Password + Retype | **Built** | `POST /auth/forgot-password/verify` |
| FR-5.4 | On match: update password, reset `no_of_login_attempt` to 0, clear the code | **Built** | Also restores a `locked` account to `active` — this is the only unlock path in the product |
| FR-5.5 | On mismatch: error, password unchanged | **Built** | Wrong attempts are counted; past `RESET_PASSWORD_OTP_MAX_ATTEMPTS` (default 5) the code is burned |
| FR-5.6 | Code lifetime | **Built** | `RESET_PASSWORD_OTP_TTL_MINUTES`, default 10. At most one outstanding code per account — a new request supersedes the previous one. |

### FR-6 — Product Browsing (Student) · `student/products`
| # | Requirement | Status | Implementation |
|---|---|---|---|
| FR-6.1 | Home lists the Company's non-deleted products with image, name, description, price, veg/non-veg | **Built** | `GET /student/products` — sold-out items are **included and flagged**, not hidden; sorted alphabetically by name; unpaginated (the diner-facing menu returns the whole menu in one call) |
| FR-6.2 | `[ADD +]` increments that product's quantity in the in-progress cart | **Built** | Cart is client-side state (`CartContext`) until checkout |
| FR-6.3 | A persistent bottom bar shows "N item(s) added" with **Continue ›** once quantity > 0 | **Built** | `CartSummaryBar` |
| FR-6.4 | Sold-out products are visibly marked and cannot be added | **Built** | Enforced in the UI **and** re-validated server-side at order time (FR-7.5) |
| FR-6.5 | **[Note]** Products have no menu/food category | **By design** | Products carry no category concept in V1. `Category` means registrant affiliation only. |

### FR-7 — Cart, Checkout & Order Placement · `student/orders`
| # | Requirement | Status | Implementation |
|---|---|---|---|
| FR-7.1 | Cart lists each line with name, description, +/- quantity, line total | **Built** | `CartScreen` |
| FR-7.2 | Cart shows Total Amount and a Place Order action | **Built** | Money is stored and computed as **integer paise**, never float |
| FR-7.3 | Payment method selector with a default preselected | **Built (changed)** | There is no in-app selector. V1 is UPI-only; the Razorpay Checkout SDK opens with a dashboard-configured UPI-only method set (`RAZORPAY_CONFIG_ID`). |
| FR-7.4 | Fulfilment type fixed to Canteen Pickup; no address capture | **Built** | `orders.fulfilment_type = 'pickup'`, enforced by a database CHECK constraint |
| FR-7.5 | On Place Order: create the order `payment_pending` with an immutable item snapshot | **Built** | The server re-reads every product and builds the snapshot (`product_id`, `name`, `price`, `quantity`, `line_total`) from **its own** data. The client sends only product ids and quantities — it cannot influence price. Any deleted or sold-out line rejects the whole order, naming the offending products. |
| FR-7.6 | **[Added]** At most one unresolved order per diner | **Built** | Placing an order while one is still `payment_pending`/`payment_failed` returns the **existing** order rather than creating a second |
| FR-7.7 | **[Added]** The Razorpay order is created before the row is inserted | **Built** | The network call is deliberately kept outside the database transaction; the order row is written once, already carrying its gateway reference |

### FR-8 — Payment Confirmation · `payments/webhook`
| # | Requirement | Status | Implementation |
|---|---|---|---|
| FR-8.1 | Order status is finalized **only** by the server-side webhook | **Built** | `POST /payments/webhook`, unauthenticated by design; HMAC-SHA256 verified against the **raw request bytes** (`rawBody`), never a re-serialized body |
| FR-8.2 | Success → `order_placed`, `payment_status = success`, generate a 6-digit numeric pickup code | **Built** | The code is generated exactly once, at this transition |
| FR-8.3 | Failure → `payment_failed`, `payment_status = failed`, offer "Pay Again" on the same order | **Built** | Only the *current* attempt may finalize a failure; a stale attempt's failure never overrides a newer one |
| FR-8.4 | Redelivered webhook events must not be reprocessed | **Built** | Each attempt carries its own `resolved_at`/`outcome`; an already-resolved attempt is ignored |
| FR-8.5 | The pickup code is shown in-app for as long as the order is undelivered | **Built** | `OrderDetailScreen`. Pickup must never depend on a push having arrived. |
| FR-8.6 | **[Added]** An "order ready" push is sent on success | **Built** | Best-effort via FCM; the result is recorded as an `order_audit_logs` event, and a delivery failure never affects the webhook's own response |
| FR-8.7 | **[Added]** Resume payment also works from `payment_pending`, not only `payment_failed` | **Built** | `POST /student/orders/:orderId/retry-payment`. A new `payment_attempts` row is created and the previous one is marked not-current, so every gateway reference ever issued stays correlatable. |

### FR-9 — Pickup Fulfilment
Covered by FR-3.2–FR-3.5. A `deliveries` row records `order_id` (unique), `company_id`, `delivered_by`, `delivered_at`.

### FR-10 — Profile · `me/profile`, `me/change-password`
| # | Requirement | Status | Implementation |
|---|---|---|---|
| FR-10.1 | Profile shows the signed-in user's details, varying by role | **Built** | `GET /me/profile`. Student → Category + Department; Company Admin/Staff → Company name; System Admin → neither. Open to every authenticated role. |
| FR-10.2 | Username is not editable anywhere, including via the API | **Built** | `UpdateProfileDto` has no `name`, `username`, or `category_id` field at all; the global validation pipe rejects unknown fields outright (`400`) |
| FR-10.3 | Edit allows Email and (Student only) Department | **Built** | `PATCH /me/profile` — the Student-only restriction on `department_id` is enforced in the service, which knows the caller's role |
| FR-10.4 | Change Password requires the current password plus a new one | **Built** | `POST /me/change-password` — distinct from the FR-5 OTP flow |
| FR-10.5 | A successful password change revokes the user's other sessions | **Built** | The current session stays signed in |
| FR-10.6 | Name is read-only | **Built** | Resolves open question Q7 |

### FR-11 — My Orders · `student/orders`
| # | Requirement | Status | Implementation |
|---|---|---|---|
| FR-11.1 | Split into **Upcoming** (`payment_pending`, `order_placed`) and **History** (`delivered`, `payment_failed`, `cancelled`) | **Built** | `GET /student/orders?view=upcoming|history`. `cancelled` is included for completeness but is **unreachable** — no code path sets it. |
| FR-11.2 | Order detail shows the item snapshot, total, status, and status-specific content | **Built** | `GET /student/orders/:orderId` |
| FR-11.3 | Line items reflect price/name at order time, not current product data | **Built** | Guaranteed by the immutable JSON snapshot (FR-7.5) |
| FR-11.4 | The pickup code is exposed only while `order_placed` | **Built** | The mapper returns `otp: null` for every other status, including `delivered` |
| FR-11.5 | `delivered_at` is returned only once delivered | **Built** | |

### FR-12 — Contact Us *(added, `specs/015`)* · `me/contact-us`
| # | Requirement | Status | Implementation |
|---|---|---|---|
| FR-12.1 | Any signed-in tenant user can view their own canteen's contact details | **Built** | `GET /me/contact-us` — `company_admin`, `company_staff`, `student`, `teaching`, `non_teaching` |
| FR-12.2 | Shows company name, contact person, phone, email, address, operating hours | **Built** | A deliberately narrow read-only projection — it never exposes `is_open`/`is_sms`, which are System Admin concerns |
| FR-12.3 | Operating hours are free text, set only by System Admin; unset renders as "Not specified" | **Built** | |
| FR-12.4 | This is the first real destination `teaching`/`non_teaching` users get beyond Profile | **Built** | |

### FR-13 — Feedback *(added, `specs/016`)* · `me/feedback`, `tenant/feedback`
| # | Requirement | Status | Implementation |
|---|---|---|---|
| FR-13.1 | Any signed-in tenant user can submit feedback about their canteen | **Built** | `POST /me/feedback` — no role restriction |
| FR-13.2 | Fields: optional rating 1–5; required category; required message 1–1000 chars; optional "contact me" flag | **Built** | All four constrained by database CHECK constraints *and* DTO validation |
| FR-13.3 | Fixed six-value category set | **Built** | `app_experience`, `food_order_quality`, `payment_issue`, `pickup_experience`, `suggestion`, `other`. Unrelated to the per-tenant `Category` master table. |
| FR-13.4 | Company Admin reviews the queue and marks items resolved | **Built** | `GET`/`PATCH /tenant/feedback` — `company_admin` only; Staff never get this entry point |
| FR-13.5 | Status is one-way `new → resolved` | **Built** | No re-open path |
| FR-13.6 | Feedback mutations are audit-logged | **Built** | Via the same database trigger used for products/orders/payments |

### FR-14 — Registration Mobile Verification *(added, `specs/014`)* · `auth/register/*`
| # | Requirement | Status | Implementation |
|---|---|---|---|
| FR-14.1 | Send a 6-digit numeric code to the mobile number being registered | **Built** | `POST /auth/register/send-verification` — always `202` |
| FR-14.2 | Channel follows the Company's `is_sms` flag | **Built** | SMS (MSG91) when true, FCM push when false. Unlike forgot-password, a hard send failure is **surfaced as an error**, not silently swallowed. |
| FR-14.3 | Verify exchanges the code for a short-lived, single-use verification token | **Built** | `POST /auth/register/verify-mobile`. The token is opaque random bytes (not a JWT), TTL 20 minutes, consumed atomically with the user row's creation so it can never be replayed. |
| FR-14.4 | Registration enforces the token only when the rollout flag is on | **Built** | `MOBILE_VERIFICATION_REQUIRED`, **default `false`** — registration behaves exactly as before while DLT template approval is pending |
| FR-14.5 | Resend cooldown, because each send is billed | **Built** | `MOBILE_VERIFICATION_RESEND_COOLDOWN_SECONDS`, default 60. One outstanding verification per (Company, mobile number); a new request supersedes the old. |
| FR-14.6 | Separate DLT template from the password-reset message | **Built** | `MSG91_TEMPLATE_ID_MOBILE_VERIFICATION` vs `MSG91_TEMPLATE_ID_PASSWORD_RESET` — India's DLT rules require one registered template per distinct message |

### FR-15 — Device Registration *(`specs/009`)* · `me/devices`
| # | Requirement | Status | Implementation |
|---|---|---|---|
| FR-15.1 | Any signed-in user registers their FCM token for push | **Built** | `POST /me/devices` — no role restriction |
| FR-15.2 | An unauthenticated registration path exists for forgot-password | **Built** | Needed because a user who cannot log in still has to receive the reset push |

### FR-16 — Product Images *(`specs/004`, revised)* · `products/image/:key`
| # | Requirement | Status | Implementation |
|---|---|---|---|
| FR-16.1 | Company Admin uploads a product photo | **Built** | `POST /tenant/products/:productId/image`, multipart, MIME-allowlisted |
| FR-16.2 | **[Changed]** Storage is a private Railway Bucket, not Supabase Storage | **Built** | |
| FR-16.3 | Images are served through this API, never a public bucket URL | **Built** | `GET /products/image/:key`, unauthenticated so an `<Image src>` works. The returned URL is built from `PUBLIC_API_BASE_URL`. |

## 4. Non-Functional Requirements

| Category | Requirement | As built |
|---|---|---|
| **Multi-tenancy** | Tenant-scoped data isolated by `company_id`, enforced independently at the API layer and by PostgreSQL RLS; neither layer alone may be sufficient to leak | **Met.** All 16 tenant-relevant tables have RLS enabled, each with its own policies. The API connects as the non-owner `app_user` role precisely so RLS actually applies to it. `company_id` is always taken from verified JWT claims, never from a request body or path. |
| **Performance** | Product list and cart interactions feel instant | **Met.** Cart is local client state until checkout; list endpoints are paginated. |
| **Security** | Passwords hashed; OTPs single-use and time-bound; short-lived JWTs with revocable refresh tokens | **Met.** Argon2id for passwords; SHA-256 for refresh tokens, reset codes, and verification codes. The order pickup code is the one deliberate plaintext exception — the diner must re-read it. Unknown request fields are a `400`, not silently dropped. |
| **Availability** | Payment reconciled by webhook even if the app is closed after redirect | **Met.** The webhook is the only authority; resume/retry works from either `payment_pending` or `payment_failed`. |
| **Auditability** | Soft delete and `created_by`/`updated_by`/`created_at`/`updated_at` everywhere; business-critical mutations recorded automatically | **Met, with a caveat.** The `audit_logs` trigger covers `products`, `orders`, `payment_attempts`, `feedback`. `auth_audit_logs` and `order_audit_logs` capture non-row events. **No role can read any of it through the API** (BRD Gap G6). |
| **Notifications** | OTP and order-status delivery | **Met, extended.** FCM for order-ready and for push-routed codes; MSG91 SMS where the Company opts in. |
| **Resilience** | Third-party outages must not prevent startup | **Met.** Railway Bucket, Firebase, Razorpay and MSG91 are all optional at boot; only the database and `JWT_SECRET` are mandatory. Missing integrations fail at the specific request, not at startup. |
| **Testing** | Unit, contract, and RLS tests | **Partial.** `api/test/{unit,contract,rls}` and `mobile/test` exist; the 80% threshold in `.coverage-thresholds.json` is the blocking gate. RLS/integration tests must never run against the real Supabase instance. |
| **Browser support** | — | **Not addressed.** The API does not enable CORS. Any web client is blocked today (BRD Gap G7). |

## 5. Data & Domain Notes

- **Money** is stored as an integer in paise throughout — never a float.
- **Order item snapshot** is a JSON array on `orders.items`, written server-side, immutable afterwards.
- **Three similarly-named concepts, deliberately distinct:**
  - `Role` — a platform-wide permission grant. Six fixed values. Global, not per-tenant.
  - `Category` (table) — a per-Company registrant-affiliation label on a user ("Student", "Teaching Staff"). Required for a `student`. Not a food classification.
  - `Feedback.category` — a fixed six-value classification of a feedback item. Unrelated to either of the above.
- **Soft delete only.** `is_deleted` on companies, categories, departments, users, products, feedback. Foreign keys use `onDelete: Restrict` as a defense-in-depth guard against an accidental hard delete.

### 5.1 List conventions (relevant to any new client)

- **Paginated, with search:** `/tenant/products`, `/tenant/categories`, `/tenant/departments`. Query params `page` (1-based, default 1), `limit` (default 10, **capped at 50** so a client cannot force an unbounded query), and `search` (case-insensitive substring match on `name`). Products additionally accept `is_veg`. The response envelope is `{ items, page, limit, total }`.
- **Unpaginated (plain arrays):** `/tenant/users`, `/admin/users`, `/admin/companies`, `/student/products`, `/tenant/staff/orders`. A web console with large tenants will likely want pagination added to the user and company lists.
- **Fetching only a count** is done by requesting `limit=1` and reading `total` — this is how the mobile Company Admin dashboard renders its stat cards.

## 6. Open Questions — Now Resolved by the Build

| # | Original question | Answer in code |
|---|---|---|
| Q1 | Is Department mandatory at registration? | **Optional.** Category is the required one. |
| Q2 | Login-attempt lockout threshold and duration? | **5 consecutive failures** (`ACCOUNT_LOCK_THRESHOLD`) sets `status = locked`. There is **no time-based unlock** — the only way out is a successful password reset. |
| Q3 | Which payment gateway is default for V1? | **Razorpay, UPI-only.** The only one integrated. |
| Q4 | Can a Company Admin create other Company Admins? | **No.** `/tenant/users` is deliberately limited to `company_staff`, `student`, `teaching`, `non_teaching`. Creating a `company_admin` is System Admin only. |
| Q5 | Does `is_open = false` hide the Company or just block orders? | **Neither — it does nothing.** The flag is stored and editable by System Admin but is never read. See BRD Gap G3. |
| Q6 | Is diner-initiated order cancellation in scope? | **No.** `cancelled` exists in the schema and in the History filter but is unreachable. |
| Q7 | Is Name editable on Profile? | **No.** Read-only, like Username. |
| Q8 | Does a `cancelled` order support any student action? | **Moot** — unreachable. |

## 7. Still Open

| # | Question | Why it matters now |
|---|---|---|
| Q9 | Should `is_open` actually gate order placement, and should the Company Admin own that toggle? | FR-2.4 is documented behaviour that does not exist. A canteen that believes it is closed still takes orders. |
| Q10 | Should `teaching` / `non_teaching` get real ordering capability, or be retired in favour of Category? | Two roles currently exist that can log in but can do almost nothing. |
| Q11 | Who is the primary audience for the planned website — System Admin, Company Admin, or diners? | Decides whether the web build reuses the tenant-scoped API surface or the platform-scoped one. See BRD §12. |
| Q12 | Should audit data become a product feature (a read endpoint, an admin screen), or stay DBA-only? | Affects whether the website needs an audit view. |
| Q13 | Is iOS still in scope? | `mobile/` currently has an `android/` project only — no `ios/` directory exists. |

## 8. Acceptance Criteria (Sample — Order Placement)

- **Given** a diner with items in their cart,
  **when** they tap Place Order,
  **then** the server re-validates every line against live product data, rejects the order if any item is sold out or deleted, and otherwise creates **one** order with `status = payment_pending` and a server-built price snapshot, together with a Razorpay order and a `payment_attempts` row.

- **Given** that diner already has an unresolved order,
  **when** they tap Place Order again,
  **then** the existing order is returned and **no second order is created**.

- **Given** Razorpay confirms success,
  **when** the webhook arrives and its HMAC signature verifies against the raw bytes,
  **then** the order becomes `order_placed`, a 6-digit pickup code is generated exactly once, an order-ready push is attempted, and the result is written to `order_audit_logs`.

- **Given** the same webhook event is redelivered,
  **when** it arrives a second time,
  **then** the already-resolved attempt is ignored and no state changes.

- **Given** Razorpay confirms failure for the current attempt,
  **when** the webhook arrives,
  **then** the order becomes `payment_failed` and the diner is offered "Pay Again" against the *same* order id.

- **Given** an `order_placed` order,
  **when** Staff submit the correct pickup code,
  **then** the order becomes `delivered`, a `deliveries` row is written, and the code stops being returned by the API — and a second submission of the same code returns `409`, not a second delivery.
