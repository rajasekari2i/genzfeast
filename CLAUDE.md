# CLAUDE.md

Guidance for Claude Code when working in this repository. Source of truth is `docs/` — this file is an orientation summary, not a replacement. If anything here conflicts with `docs/`, trust `docs/` and flag the mismatch.

## Project

**GenzFeast** — a multi-tenant mobile food ordering platform connecting college canteens ("companies"/tenants) with students on campus. Each canteen is an independent tenant with its own staff, products, and orders; a central **System Admin** governs onboarding and platform-wide oversight.

Core docs (read before making product/architecture decisions):
- `docs/product/01-BRD.md` — business problem, objectives, stakeholders, scope, business rules
- `docs/product/02-PRD.md` — functional requirements (FR-1..FR-11), roles, NFRs, open questions
- `docs/architecture/04-Architecture.md` — tech stack, auth design, multi-tenant isolation strategy, sequence diagrams
- `docs/ui-screen/06-UI-Design.md` — screen-by-screen UX spec per app surface

This repo also uses **spec-kit** (`.specify/`, `specs/`) for spec-driven feature development. Feature specs, plans, and tasks live under `specs/<NNN-feature-name>/`. Use `/speckit-specify`, `/speckit-plan`, `/speckit-tasks` for new feature work rather than free-form planning.

**Coding standard**: `coding_standard.md` at the repo root governs how code is actually written (NestJS module structure, TypeScript rules, Prisma/RLS query patterns, error handling, testing, secrets). Read it before writing any implementation code — it's especially load-bearing on how Prisma must be used alongside this project's Postgres RLS design (§4.3 there), which is easy to get subtly wrong.

## Tech Stack (decided — do not re-litigate without a documented reason)

| Layer | Technology |
|---|---|
| Mobile client | React Native (Android + iOS), single codebase, per-tenant branded build flavors, NativeWind (Tailwind CSS compiler) for styling |
| Backend API | Node.js + **NestJS**, **TypeScript** (decided in `specs/001-company-role-user-setup/research.md` §1 — DI/Guards map cleanly onto this project's per-request tenant/role scoping) |
| ORM | **Prisma** — see `coding_standard.md` §4 for the RLS/session-variable interaction, which Prisma does not handle automatically |
| Database | **Supabase (managed PostgreSQL)** — relational, not Firestore |
| File storage | Supabase Storage (product images) |
| Auth | **Stateless JWT** access tokens (short-lived, 15–60 min) issued/verified by the Node API, + DB-tracked revocable refresh tokens. NOT Supabase Auth, NOT Firebase Auth, NOT session cookies |
| Push notifications | **Firebase Cloud Messaging only** — no other Firebase product (no Firestore, no Firebase Auth, no Firebase Storage) |
| Payments | Razorpay, UPI-only in V1, server-verified via webhook (never trust client redirect alone) |
| Hosting | Cloud Run or any Node-compatible container host |

## Multi-Tenancy — the most important constraint in this codebase

Every tenant-scoped table (`users`, `products`, `orders`, `categories`, `departments`, etc.) carries `company_id` and **must** be isolated two ways simultaneously:
1. **API layer**: every query filtered by `company_id` taken from the verified JWT claims — never from the request body/path.
2. **Postgres RLS**: policies independently re-check tenant scoping via session variables (`SET LOCAL app.current_company_id`, `app.current_role`, `app.current_user_id`) set once per request/transaction.

A bug at either layer alone must never be sufficient to leak data across tenants — this is a named top risk in the BRD. `system_admin` is the only role with legitimate cross-tenant reach (full CRUD over Roles/Categories/Departments/Companies platform-wide), and that bypass must be scoped narrowly (a predicate in the RLS policy), not a blanket `BYPASSRLS`.

## Roles (fixed set for V1 — do not invent new roles without a spec update)

| Role | Scope | Can do |
|---|---|---|
| `system_admin` | Platform-wide, `company_id = NULL` | Create/manage Companies; create a Company's first Company Admin; full CRUD over Roles/Categories/Departments across every tenant |
| `company_admin` | One Company | Manage Staff + peer Company Admin accounts, Categories, Departments, Products (CRUD), toggle company open/closed |
| `staff` | One Company | Toggle product sold-out, fulfil orders via OTP |
| `student` | One Company | Register/login, browse, cart, checkout, pay, pick up with OTP |

A Company's three tenant-scoped roles (`company_admin`, `staff`, `student`) are auto-seeded when the Company is created (DB trigger, not application code — see `specs/001-company-role-user-setup/research.md` §3). A student registers into exactly one Company; the same mobile number may hold independent accounts at two different Companies since username uniqueness is per-tenant, not global.

**Category vs Department (easy to confuse):** `Category` is the registrant's affiliation type at registration — e.g. "Student", "Teaching Staff", "Non-Teaching Staff" — scoped per Company, required at Student registration. `Department` is the student's academic department, also per-Company, optional. Neither is a food/product classification.

## Order Lifecycle

```
payment_pending → order_placed → delivered
              ↘ payment_failed → (Pay Again, same order, no duplicate)
```

- Order status is finalized **only** by the server-side payment webhook, never by client-side redirect alone.
- OTP: a random 6-digit numeric OTP is generated once, at the moment payment succeeds; single-use; invalidated once `delivered`; not returned by the API once delivered.
- Forgot-password uses a **separate** 6-character alphanumeric OTP (`reset_password_otp`), delivered via FCM push, with an in-app fallback screen (since push delivery isn't guaranteed).
- `no_of_login_attempt` increments on failed login and on every forgot-password request; resets to 0 only after a successful password reset.

## Data Conventions

- Soft delete everywhere: `is_deleted` boolean, never hard-delete a record referenced elsewhere (e.g. a Category/Department still referenced by a User/Product). Deactivating a user sets `status = inactive`, not a delete.
- Auditability: every table carries `created_by`, `updated_by`, `created_at`, `updated_at`. Every mutation of a business-critical table (`companies`, `users`, `products`, `orders`, `deliveries`, ...) is additionally recorded in `audit_logs` **automatically via DB trigger** — don't rely on application code to log this.
- Passwords are always hashed (bcrypt/argon2) despite any legacy field named `password` in older drafts — never store plaintext.
- Money: store as integer (paise/cents), never float.

## V1 Scope Boundaries

**In scope**: canteen pickup only (no delivery-address flow), one payment gateway (Razorpay/UPI only), OTP-based pickup verification, forgot-password via push OTP, mobile-only student experience.

**Out of scope for V1** (don't build unless a spec explicitly reopens it): home/hostel delivery, multiple payment gateways, loyalty/rewards/ratings, student web portal, live order tracking map, in-app chat, automated refunds.

## Working in This Repo

- This is currently a spec-only repository — no application source code exists yet. Feature work should go through the spec-kit flow (`/speckit-specify` → `/speckit-plan` → `/speckit-tasks`) so multi-tenancy/RLS/audit rules above are re-verified per feature rather than assumed.
- `.specify/memory/constitution.md` is an unfilled template — in its absence, `docs/architecture/04-Architecture.md` + `docs/product/01-BRD.md` are the governing constraints for any plan's Constitution Check (this is Architecture §11's own stated mapping).
- Before assuming a technical or scope decision is "obvious," check `docs/product/02-PRD.md` §5 (Open Questions for Business Sign-off) and any feature's `spec.md` Assumptions — several plausible defaults (e.g., can a Company Admin create another Company Admin?) have already been explicitly decided per-feature and shouldn't be re-guessed differently elsewhere.

