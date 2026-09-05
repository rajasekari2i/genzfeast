# Phase 0 Research: Company, Role, Category, Department & User Creation

**Feature**: `001-company-role-user-setup` | **Date**: 2026-09-05

Most technology choices for GenzFeast are already fixed by `docs/architecture/04-Architecture.md` (Supabase/PostgreSQL, stateless JWT, React Native, Firebase Cloud Messaging, Razorpay) and are treated here as decided constraints, not open research questions. This document resolves the remaining implementation-pattern unknowns needed to design this specific feature (tenant, role, master-data, and user creation/administration).

## 1. Backend framework: NestJS vs. Express

- **Decision**: NestJS.
- **Rationale**: The Architecture doc leaves "Express/NestJS" open. This feature's core problem is enforcing three cross-cutting concerns on almost every endpoint — JWT-claim extraction, role-based authorization (System Admin vs. Company Admin vs. Staff vs. Student), and `company_id` scoping (Architecture §6) — plus wiring a `SET LOCAL app.current_*` block before every DB call. NestJS's Guards (`RolesGuard`, `TenantScopeGuard`), Interceptors, and module system map directly onto these concerns and onto the existing Module-1..N document structure (Platform Admin, Tenant Administration, etc.), each becoming a Nest module. This keeps the per-tenant/per-role rules declarative and centrally testable instead of re-implemented per route.
- **Alternatives considered**: Plain Express — faster to bootstrap, but tenant/role scoping and audit-trail concerns would need hand-rolled middleware ordering per route, which is more error-prone for exactly the kind of cross-tenant leakage the BRD calls out as a top risk (BRD §9).

## 2. Multi-tenant Row Level Security + System Admin bypass pattern

- **Decision**: Every company-scoped table (`categories`, `departments`, `users`) gets an RLS policy of the shape:
  `USING (company_id = current_setting('app.current_company_id', true)::uuid OR current_setting('app.current_role', true) = 'system_admin')`
  applied for `SELECT`/`UPDATE`/`DELETE`, and an equivalent `WITH CHECK` for `INSERT`/`UPDATE` so a row can never be written into a company_id its role isn't allowed to touch. The backend sets `app.current_company_id`, `app.current_role`, `app.current_user_id` via `SET LOCAL` inside the same transaction as every query (Architecture §6.3), sourced only from the verified JWT claims — never from the request body.
- **Rationale**: This directly implements the two-layer defense the BRD already commits to ("Node API scopes every query by `company_id`... *and* Postgres RLS policies independently re-check tenant scoping" — BRD §9) and gives System Admin's now-confirmed full cross-tenant CRUD (spec FR-005/FR-021) a single, auditable bypass condition instead of scattering `IF role === 'system_admin'` checks across application code.
- **Alternatives considered**: Application-layer scoping only (rejected — BRD explicitly flags this as insufficient on its own); a separate System Admin bypass role at the Postgres level via `BYPASSRLS` (rejected — too coarse, it would bypass RLS for *every* table forever, whereas the policy predicate above scopes the bypass to exactly the tables/rows this feature intends).

## 3. Seeding default roles when a Company is created

- **Decision**: A Postgres `AFTER INSERT` trigger on `companies` inserts the three tenant-scoped rows (`company_admin`, `staff`, `student`) into `roles` with the new `company_id`, in the same transaction as the company insert.
- **Rationale**: Matches the repo's own established pattern of using DB triggers for guarantees that must never depend on application code remembering to do something (the `audit_logs` triggers, per BRD Assumption 8 / Architecture §7). A trigger makes "every company has its 3 roles" a database invariant, not a convention the API layer could forget or get out of sync with FR-003.
- **Alternatives considered**: Seeding roles from the API handler in the same transaction as the company insert — workable, but reintroduces exactly the "must remember to do this in every code path that can create a company" risk the trigger approach avoids.

## 4. Soft delete & uniqueness for Category / Department

- **Decision**: `categories` and `departments` carry `is_deleted boolean not null default false`. Name uniqueness is enforced with a partial unique index scoped to `(company_id, lower(name)) WHERE is_deleted = false`, so a removed entry's name can be reused later without a permanent collision, while existing `users.category_id` / `users.department_id` foreign keys are left untouched (no `ON DELETE` cascade or nulling) when an entry is soft-removed.
- **Rationale**: Satisfies FR-008 (no hard delete while referenced) and the platform-wide audit/traceability NFR (PRD §4) with a pattern already used for `products.is_deleted` in the legacy data-model draft, kept consistent here.
- **Alternatives considered**: Hard delete with `ON DELETE RESTRICT` (rejected — blocks removal entirely once any reference exists, which is worse UX than hiding it from future selection); `ON DELETE SET NULL` (rejected — would silently corrupt a Student's historical Department/Category, and Category is required per FR-011/FR-020).

## 5. Per-company username uniqueness

- **Decision**: A partial unique index on `users (company_id, lower(username)) WHERE is_deleted = false`.
- **Rationale**: Implements FR-013 exactly — uniqueness scoped per tenant, not global — while still allowing a previously soft-deleted account's username to be reclaimed within the same company. `lower(username)` avoids case-variant duplicates (e.g., a mobile number stored with formatting differences is out of scope here, but casing is a cheap, standard guard).
- **Alternatives considered**: A global unique index on `username` alone (rejected — explicitly contradicts FR-013 and BRD Assumption 3, which allow the same mobile number to be an independent account at two different canteens).

## 6. Testing approach for tenant isolation

- **Decision**: Contract tests (Jest + Supertest) per endpoint covering the happy path, the duplicate-username rejection, and a cross-tenant-access-denied case for every company-scoped endpoint; plus a small dedicated RLS test suite that connects as each role (via `SET LOCAL`) directly against a test database and asserts row visibility/writability, independent of the API layer.
- **Rationale**: The BRD calls cross-tenant leakage a top risk mitigated by *two* independent layers (API + RLS) — so the test strategy should verify both layers independently, not only through the API, or a bug that happens to compensate at one layer could mask a hole in the other.
- **Alternatives considered**: API-only contract tests (rejected — would not catch an RLS policy regression that an apparently-correct API query happens to mask, e.g., in a future direct-DB-access code path such as a reporting job).

## 7. System Admin Portal implementation surface

- **Decision (assumption, not a blocking unknown)**: Implemented as a role-gated section of the same React Native codebase used for the Tenant Admin & Staff App, rather than a separate web application.
- **Rationale**: BRD Assumption 2 already commits to "a single shared codebase" with tenant configuration for branding; extending that to a role-gated (rather than tenant-configured) admin section avoids standing up and maintaining a second frontend stack for what is currently a small, internal-only set of screens (Company list/create, Create Company Admin, platform-wide Role/Category/Department management).
- **Alternatives considered**: A separate lightweight web admin (e.g., a small React/Next.js app) — reasonable if the System Admin's screen count grows significantly, but not justified for this feature's scope; can be revisited later without changing the backend API contracts in this plan, since the API surface is client-agnostic.

## Outstanding NEEDS CLARIFICATION

None. All Technical Context fields are resolved above or fixed by the Architecture document.
