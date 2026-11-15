# Business Requirements Document (BRD)
## GenzFeast — Multi-Tenant College Canteen Food Ordering Platform

| | |
|---|---|
| **Document** | BRD |
| **Product** | GenzFeast |
| **Version** | 2.0 — **as-built**, reconciled against the implemented codebase (`api/`, `mobile/`) |
| **Status** | V1 functionality complete and implemented. This document now describes what the platform *does*, not only what it was asked to do. |
| **Last reconciled** | 2026-11-06 |

> **How to read this version.** v1.x of this document was written before any code existed. The platform has since been built out across 16 feature specs (`specs/001-…` through `specs/016-…`). Every statement below has been checked against the actual implementation. Where the build deliberately diverged from the original business ask, the divergence is called out inline as **[Changed]**. Where a requirement was stated but is *not* enforced in code, it is listed in §11 (Known Gaps) rather than being quietly presented as working.

---

## 1. Purpose

GenzFeast is a multi-tenant (multi-company) mobile food ordering platform that connects college canteens ("companies"/tenants) with the people on their campus. Each canteen operates as an independent tenant with its own staff, products, master data, and orders, while a central System Admin governs onboarding and platform-wide oversight.

This document defines the business need, objectives, stakeholders, scope, and business rules. It is the governing business artifact for the PRD (`02-PRD.md`), the Architecture doc (`../architecture/04-Architecture.md`), and the UI artboards (`../ui-screen/*.html`, which replaced the original
`06-UI-Design.md` markdown spec).

## 2. Business Problem

College canteens have traditionally relied on manual, in-person, first-come-first-served ordering, which causes:

- Long physical queues during peak hours (breaks, lunch).
- No visibility into order status or wait time for the person ordering.
- No digital record of sales, demand, or stock state (sold-out items) for canteen staff.
- No standardized way to onboard a new canteen and start operating quickly.
- No structured channel for diners to report a problem with an order, the app, or a payment.

## 3. Business Objectives

| # | Objective | Success Metric | Status in V1 build |
|---|---|---|---|
| O1 | Reduce physical queue/wait time at canteens | Avg. pickup wait time reduced vs. baseline | Enabled — pre-ordered, pre-paid, OTP-verified pickup is live |
| O2 | Give each canteen an independent, self-serve digital storefront | New tenant onboarded and live in < 1 day | Enabled — System Admin creates the Company + its first Company Admin via API; that admin self-serves the rest |
| O3 | Digitize payment collection and order tracking | 100% of V1 orders paid online, OTP-verified pickup | Enabled — Razorpay UPI, server-verified by webhook; orders cannot reach `order_placed` any other way |
| O4 | Give staff a simple tool to manage stock and fulfilment | Staff can mark sold-out / close an order in ≤ 2 taps after login | Enabled — Staff side-menu lands directly on Incoming Orders and Products |
| O5 | Let the platform owner operate many canteens from one system | Onboard N tenants without code changes per tenant | Enabled for data/API. **Partially** for the app: each tenant still needs its own branded build, because `COMPANY_ID` is a build-time constant (§7 Assumption 2, §11 Gap G4) |
| O6 | **[Added]** Give diners a structured way to raise issues, and canteens a queue to resolve them | Feedback submitted is triaged to `resolved` by the Company Admin | Enabled — `specs/016-feedback-management` |

## 4. Stakeholders

| Stakeholder | Platform role | Interest | App surface they actually use today |
|---|---|---|---|
| **System Admin (Platform Owner)** | `system_admin` | Onboards canteens (tenants), oversees the whole platform | **None — API only.** No UI of any kind exists for this role (§11 Gap G1) |
| **Company/Tenant Admin** | `company_admin` | Manages their canteen's users, master data, products, and feedback queue | Mobile app (role-routed drawer) |
| **Staff** | `company_staff` | Fulfils orders: marks items sold out, verifies the pickup code, hands over food | Mobile app (role-routed drawer) |
| **Student (End User)** | `student` | Browses menu, orders, pays, picks up food using the pickup code | Mobile app (role-routed drawer) |
| **Teaching / Non-Teaching (End Users)** | `teaching`, `non_teaching` | *Intended* to order like a Student | **[Changed]** These roles exist and can be created and logged in, but have **no ordering capability wired up**. They currently reach only Profile, Contact Us, and Feedback. See §11 Gap G2 |
| **Engineering** | — | Builds and maintains the system from these specs | — |

> **Important distinction.** "Teaching Staff" / "Non-Teaching Staff" also exist as **Category** values — a per-Company affiliation *label* on a user, chosen at registration. That is a different thing from the `teaching` / `non_teaching` **Roles**, which are permission grants. A user's Category and Role are independent fields and nothing keeps them in sync. Most campus staff who order today are expected to be registered as `student`-role users carrying a "Teaching Staff" **Category**.

## 5. Scope — V1 (In Scope, and Built)

All of the following are implemented and working in the current codebase.

**Platform governance (System Admin)**
- Create and manage Companies (canteens), including the `is_open` and `is_sms` flags and free-text operating hours.
- Create a Company's first Company Admin, and manage `company_admin` / `company_staff` accounts across any tenant.
- **[Changed]** Category and Department master data is managed by each **Company Admin** within their own tenant, *not* centrally by the System Admin. The original ask (central platform-wide CRUD over Categories/Departments) was not built that way — these are tenant-scoped tables with tenant-scoped endpoints.
- **[Changed]** Roles are **not** CRUD-able by anyone. The role catalog is a fixed, global, seeded set (`system_admin`, `company_admin`, `company_staff`, `student`, `teaching`, `non_teaching`); the application database user has no write permission on the `roles` table at all.

**Tenant administration (Company Admin)**
- User management within their own Company: create/edit/deactivate/soft-delete `company_staff`, `student`, `teaching`, and `non_teaching` accounts. **[Changed]** A Company Admin deliberately **cannot** create or edit a peer Company Admin — that remains a System Admin action.
- Category and Department master data CRUD (soft delete).
- Product CRUD, including photo upload, with soft delete and sold-out toggle.
- Feedback review queue: read submitted feedback and mark it `resolved`.

**Counter operations (Staff)**
- Toggle a product's sold-out flag.
- View incoming (`order_placed`) orders, oldest first.
- Verify the diner's 6-digit pickup code to complete handover; a mismatch is recorded and rejected without changing the order.

**Diner experience (Student)**
- Self-registration (name, 10-digit mobile as username, password, email, gender, Category, optional Department), with optional SMS mobile-number verification.
- Login, logout, forgot-password reset, change password, profile view/edit.
- Browse the menu, build a cart, pay by UPI, receive a pickup code, show it at the counter.
- My Orders, split into Upcoming and History, with an order detail view.
- Resume or retry payment on a stuck or failed order, without creating a duplicate order.
- Contact Us (their canteen's contact details and hours) and Feedback submission.

**Cross-cutting**
- Order lifecycle `payment_pending → order_placed → delivered`, with a `payment_failed` retry path.
- Per-Company choice of OTP delivery channel (SMS via MSG91 vs. push via FCM) for forgot-password and registration verification.
- Tamper-evident audit trail written by database triggers.

## 6. Out of Scope (V1)

- Home/hostel delivery (address-based delivery) — pickup only.
- Multiple payment gateways — Razorpay UPI only.
- Loyalty/rewards, ratings & reviews, sales analytics dashboards.
- **Web portal.** Mobile-only in V1. *(This is the primary candidate for the next phase — see §12.)*
- Real-time order-tracking map / live rider tracking (not applicable — pickup only).
- In-app chat/support. *(Partially superseded: the Feedback module added in `specs/016` gives an asynchronous version of this.)*
- Refund automation — manual/ops-handled.
- Order cancellation by the diner. A `cancelled` status exists in the data model and in the History filter, but **no code path ever sets it**.

## 7. Assumptions (reconciled with the build)

1. **Database is Supabase (managed PostgreSQL)**, not Firebase/Firestore. Firebase is retained for **Cloud Messaging only**. *(Confirmed in build.)*
2. **"Separate app per tenant" means a branded build from one shared codebase**, not a forked codebase. *(Confirmed in build — but see §11 Gap G4: the tenant's `COMPANY_ID` is baked in at build time via `react-native-config`, so this is a genuine per-tenant build, not a runtime tenant picker.)*
3. **One account belongs to exactly one Company.** Username uniqueness is per-tenant, not global, so the same mobile number can hold independent accounts at two different canteens. *(Confirmed in build.)*
4. **Payment is Razorpay, UPI-only.** The UPI restriction is applied through a Razorpay Dashboard payment-method configuration referenced by the client at checkout, not by server-side enforcement. *(Confirmed in build.)*
5. **"Category" = registrant affiliation label; "Department" = academic department.** Both are per-Company master tables. Category is required for a Student; Department is optional. *(Confirmed in build.)* Neither is a food/menu classification — **products carry no category concept at all** in V1.
6. **[Changed] OTP delivery is no longer FCM-only.** There are now three distinct codes with three distinct rules:
   - **Order pickup code** — 6-digit numeric, stored in plaintext (the diner must be able to re-read it), pushed via **FCM only**, always also visible in-app. Never SMS, regardless of any flag.
   - **Forgot-password code** — 6-character alphanumeric (ambiguous characters such as `0/O` and `1/I/l` excluded), stored only as a SHA-256 hash. Delivered by **SMS (MSG91) when the user's Company has `is_sms = true`**, falling back to FCM push if the SMS send fails; delivered by FCM push directly when `is_sms = false`.
   - **Mobile-verification code** — 6-digit numeric, hashed, pre-account. Same per-Company `is_sms` routing. Has **no silent fallback**: a send failure is surfaced as an error, because registration can depend on it.
7. **Authentication is stateless JWT access tokens plus database-tracked, revocable refresh tokens** — not session cookies, not Supabase Auth, not Firebase Auth. *(Confirmed in build.)*
8. **Every mutation of a business-critical table is recorded in `audit_logs` by a database trigger**, not by application code. *(Confirmed in build, for `products`, `orders`, `payment_attempts`, and `feedback`.)*
9. **[Changed] Product images are stored in a Railway Bucket (S3-compatible), not Supabase Storage.** The bucket is private; images are served through this API's own `GET /products/image/:key` proxy route, never a public bucket URL.
10. **[Added] Passwords are hashed with Argon2id**, through a single shared code path used by registration, admin-created accounts, password reset, change-password, and the bootstrap seed script.

## 8. Business Rules (as enforced in code)

1. A diner can only browse and order from the single Company they registered with. Enforced twice: by the `company_id` claim in their JWT, and independently by PostgreSQL Row Level Security.
2. A product marked **sold out** or soft-deleted cannot be placed in a new order — the server re-validates every line item at order time and rejects the whole order, naming the unavailable products. Historical orders referencing it remain intact.
3. An order can only move to `order_placed` when the **Razorpay webhook** confirms payment, with a verified HMAC-SHA256 signature over the raw request bytes. A client-side redirect alone never finalizes an order.
4. **A pickup code is generated exactly once**, at the moment the webhook confirms payment. It is single-use, is withheld from the API once the order is `delivered`, and is never shown to Staff — Staff can only submit a candidate code for comparison.
5. A failed payment leaves the order in `payment_failed` with a "Pay Again" action that **reuses the same order row**. Each attempt is recorded as its own `payment_attempts` row, so a late-arriving confirmation for a superseded attempt is still correlated rather than silently dropped.
6. **[Added] A diner may have at most one unresolved order at a time.** If they try to place a new order while one is still `payment_pending` or `payment_failed`, the existing order is returned instead of a second one being created.
7. `no_of_login_attempt` increments on every failed login **and** on every forgot-password request. At **5** consecutive failures (configurable via `ACCOUNT_LOCK_THRESHOLD`) the account's `status` becomes `locked` and login is refused. It resets to `0` — and a `locked` account is restored to `active` — only on a successful password reset.
8. **[Added]** A successful password change revokes the user's other active sessions, keeping only the current one signed in.
9. **[Added]** Mobile-verification sends are rate-limited by a per-number resend cooldown (default 60s), because each send is a real, billed SMS. At most one outstanding verification exists per (Company, mobile number) pair; a new request supersedes the previous one.
10. **[Added]** Feedback is one-way two-state: `new → resolved`. There is no re-open path.
11. Nothing is ever hard-deleted. Deletion sets `is_deleted = true`; deactivating a user sets `status = inactive`.
12. **[Added]** `audit_logs` is append-only at the database level: the application's database role has `UPDATE` and `DELETE` revoked on it, and rows can only be inserted by the `SECURITY DEFINER` trigger. The application has **no read path** to this table either — it is currently a forensic/DBA artifact, not a product feature.

## 9. Risks & Constraints (with as-built mitigations)

| Risk | Mitigation as implemented |
|---|---|
| Cross-tenant data leakage | Two fully independent layers: the API filters every query by the `company_id` taken from the verified JWT (never from the request body or path), and PostgreSQL RLS policies re-check tenant scope using transaction-local session variables. The API connects as a non-superuser, non-table-owning role (`app_user`) precisely so RLS actually applies to it. A bug in either layer alone is not sufficient to leak data. |
| Per-tenant app builds increase release overhead | One shared codebase; only `colors.primary` and the build-time `COMPANY_ID` vary per tenant. Still a real per-release cost — see §11 Gap G4. |
| OTP delivery depends on push notification being received | The order pickup code is **always** visible on the order detail screen, so pickup never depends on a notification arriving. Forgot-password falls back from SMS to push. Mobile verification deliberately does **not** fall back silently, and is gated off by default (`MOBILE_VERIFICATION_REQUIRED=false`) until DLT template approval completes. |
| Payment gateway webhook reliability | Webhook signature is verified against raw bytes; redelivered events are detected and never reprocessed; every attempt is a durable `payment_attempts` row; the diner always has a "Pay Again"/"Resume Payment" path. |
| Stateless access tokens cannot be revoked early | Access-token lifetime is short (default 30 minutes); the paired refresh token is revoked immediately on logout, on password change, and on account lock. |
| SMS regulatory dependency (India DLT) | Each distinct message has its own DLT-registered template. MSG91 configuration is optional at boot — the API starts without it and fails clearly at request time instead. |
| Secrets sprawl | All configuration is validated at boot by a typed schema; a missing *required* variable fails startup immediately rather than falling back to a default. The migration-time database superuser credential is deliberately excluded from the application's own config schema so the running app can never use it. |

## 10. Operational Constraints

- **Two database credentials, by design.** `DATABASE_URL` (owner/superuser) is migration- and CLI-only. `APP_DATABASE_URL` (`app_user`) is the only credential the running API uses. This separation is what makes RLS meaningful — a superuser or table owner bypasses RLS entirely.
- **Degradable third-party integrations.** Railway Bucket, Firebase, Razorpay, and MSG91 are each *optional* at boot. The API starts without any of them and fails clearly at the specific request that needs the missing one. Only the database and the JWT secret are hard startup requirements.
- **Bootstrap.** A new environment is seeded with its first System Admin by a one-off script, from environment variables that the running application never reads.

## 11. Known Gaps — Requirements Stated but Not Enforced

These are real divergences between this document's earlier versions (and the PRD) and the shipped code. They are listed here so that no one plans future work on the assumption that they already work.

| # | Gap | Detail | Business impact |
|---|---|---|---|
| **G1** | **System Admin has no user interface.** | `admin/companies` and `admin/users` endpoints exist and are complete, but the mobile app is tenant-scoped (it requires a build-time `COMPANY_ID`) and has no System Admin surface. Onboarding a canteen today requires direct API calls. | Blocks O2 at scale. **This is the clearest driver for the planned website — see §12.** |
| **G2** | **`teaching` / `non_teaching` roles cannot order.** | Both roles can be created and can log in, but no endpoint or screen grants them browse/cart/checkout. They reach only Profile, Contact Us, and Feedback. | The BRD names them as ordering stakeholders; today they are not. Campus staff must be registered as `student`-role users with a "Teaching Staff" Category instead. |
| **G3** | **`is_open` is stored but never enforced, and no Company Admin can change it.** | The flag exists on `companies` and is editable only by System Admin. No code checks it before accepting an order, and the Company Admin dashboard has no toggle. | PRD FR-2.4 ("stops new orders when closed") is **not** true today. A "closed" canteen still accepts orders. |
| **G4** | **Tenant identity is build-time, not runtime.** | `COMPANY_ID` is compiled into each branded app build. Adding a tenant requires a new build and store release, not just a database row. | Caps how quickly O5 scales. |
| **G5** | **`cancelled` order status is unreachable.** | Present in the schema and in the History filter; no code path ever sets it. | Diners cannot cancel. Any refund is fully manual and leaves no in-product trace. |
| **G6** | **No audit-log read path.** | `audit_logs` is write-only from the application's perspective, by deliberate design. | Audit data exists but is not usable by any role without direct database access. |
| **G7** | **No CORS configuration on the API.** | The NestJS bootstrap does not call `enableCors()`. | **Any browser-based client will be blocked.** This must be addressed before the planned website can call the API at all — see §12. |

## 12. Next Phase — Direction of Travel

Two initiatives are planned on top of the completed V1. This document does not specify them; it records the business framing and the constraints they inherit.

**A. Mobile application redesign.** A visual/UX refresh of the existing React Native app. The design system is already centralized (one token file; `colors.primary` is the only per-tenant override), so a redesign is a contained change. Note that the shipped palette is **orange** (`#FF6B35`), which supersedes the blue palette named in `specs/013-blue-theme-visual-design` — the spec title is now misleading.

**B. A new website.** The strongest business case is a **System Admin / Company Admin web console**, because it closes Gap G1 directly: the back-office roles currently have either no UI at all (System Admin) or a phone-shaped UI for data-entry-heavy work (Company Admin). A diner-facing web storefront is also possible but would reopen the V1 "mobile-only" scope decision and would need its own payment and push-notification story.

Either way, the website inherits these hard constraints from the build:
- The API has **no CORS** today (Gap G7) — this is a prerequisite, not a detail.
- Authentication is `Authorization: Bearer <JWT>`, not cookies. A browser client must handle token storage and refresh deliberately.
- System Admin accounts carry `company_id = NULL`; every tenant-scoped endpoint will reject them. A web console must route by role exactly as the mobile `AppShell` already does.
- Push notifications (FCM) and the Razorpay mobile SDK are native integrations. A web client needs web-specific equivalents or must do without them.

## 13. Approval

| Role | Name | Status |
|---|---|---|
| Business Owner | _TBD_ | Pending |
| Product Owner | _TBD_ | Pending |
| Tech Lead | _TBD_ | Pending |
