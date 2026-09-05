# Implementation Plan: Company, Role, Category, Department & User Creation

**Branch**: `001-company-role-user-setup` | **Date**: 2026-09-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-company-role-user-setup/spec.md`

## Summary

Establish the foundational multi-tenant data and API layer for GenzFeast: System Admin can onboard a Company (tenant) and its first Company Admin, with the tenant's Company Admin/Staff/Student roles auto-seeded; Company Admins manage their own Category and Department master data and create Staff or peer Company Admin accounts; prospective Students self-register against a specific Company, choosing a registrant-affiliation Category and optional Department; and System Admin retains full cross-tenant CRUD over Roles, Categories, and Departments for platform-wide governance. The technical approach is a NestJS API over Supabase/PostgreSQL, enforcing tenant isolation through JWT-claim-scoped queries backed by Postgres Row Level Security (defense-in-depth per BRD §9), with role/master-data invariants (role seeding, soft-delete-only, per-tenant uniqueness) enforced at the database layer via triggers and constraints rather than relying solely on application code.

## Technical Context

**Language/Version**: TypeScript (Node.js 20 LTS) for the API; TypeScript/React Native 0.7x for the mobile client (per Architecture §1)

**Primary Dependencies**: NestJS (API framework — research.md §1), `@supabase/supabase-js` or `pg` for Postgres access, `class-validator`/`class-transformer` for DTO validation, `jsonwebtoken` for JWT verification (Architecture §4); React Native + NativeWind for the admin/registration screens (Architecture §1)

**Storage**: Supabase-managed PostgreSQL, with Row Level Security enabled on tenant-scoped tables (Architecture §2, §6)

**Testing**: Jest + Supertest for API contract tests; a dedicated SQL/pgTAP-style suite for RLS policy verification independent of the API layer (research.md §6)

**Target Platform**: API deployed as a containerized Node.js service (Cloud Run or equivalent, Architecture §9); mobile client targets Android + iOS via React Native

**Project Type**: Mobile + API (per Architecture §1: React Native client(s) + Node.js backend + Supabase)

**Performance Goals**: Admin/registration interactions should feel instant (<300ms perceived, consistent with PRD §4 NFR for the wider app); no feature-specific throughput target beyond standard interactive CRUD/admin usage (dozens of tenants, not high-frequency traffic)

**Constraints**: Every tenant-scoped query MUST be scoped by `company_id` at both the API layer and via Postgres RLS (BRD §9, two-layer defense); Category/Department/User removal MUST be soft-delete only; username uniqueness is per-tenant, not global (FR-013)

**Scale/Scope**: Initial rollout targets a handful to low tens of college-canteen tenants (BRD O5: "onboard N tenants without code changes per tenant"), each with a small admin/staff headcount and a student body in the hundreds to low thousands

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` contains only unfilled template placeholders — no project constitution has been ratified for GenzFeast yet. In its absence, this plan treats `docs/architecture/04-Architecture.md` and `docs/product/01-BRD.md` as the governing constraints (per Architecture §11, which explicitly maps "Constitution → Architecture doc + BRD" for this project's spec-driven workflow). No gate violations identified against those documents:

- Multi-tenant isolation enforced at two independent layers (API + RLS) — matches BRD §9 risk mitigation. ✅
- No new Firebase product introduced beyond the already-approved FCM (not touched by this feature). ✅
- No session-cookie or Supabase/Firebase Auth introduced — stateless JWT only, per Architecture §4. ✅
- No hard deletes of business data — soft delete + audit trail, per PRD §4 NFR. ✅

**Result**: PASS. No entries required in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-company-role-user-setup/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── openapi.yaml     # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

This is a greenfield repository (no `src/` yet). This feature establishes the initial API structure; the mobile app's admin/registration screens are noted for placement but their broader app shell is expected to be scaffolded alongside/after this feature, not solely by it.

```text
api/
├── src/
│   ├── companies/         # FR-001..004: Company CRUD, open/close toggle, role-seed trigger migration
│   ├── roles/              # FR-003, FR-005, FR-021: role listing, System Admin cross-tenant role view
│   ├── categories/         # FR-006, FR-012, FR-020: tenant-scoped + admin cross-tenant Category CRUD
│   ├── departments/        # FR-007, FR-012: tenant-scoped + admin cross-tenant Department CRUD
│   ├── users/               # FR-009..011, FR-013..019: Staff/peer-admin creation, Student self-registration
│   ├── common/
│   │   ├── guards/          # RolesGuard, TenantScopeGuard (JWT claim extraction + enforcement)
│   │   └── db/               # SET LOCAL app.current_* transaction wrapper (Architecture §6.3)
│   └── main.ts
├── migrations/              # SQL DDL from data-model.md: tables, triggers, RLS policies, indexes
└── test/
    ├── contract/            # Jest + Supertest per contracts/openapi.yaml (research.md §6)
    └── rls/                 # Direct-DB RLS policy tests, independent of the API layer

mobile/
└── src/
    ├── screens/
    │   ├── system-admin/    # Company list/create, Create Company Admin, platform-wide Role/Category/Department management (role-gated section — research.md §7)
    │   ├── tenant-admin/     # Staff/peer-admin creation, Category/Department management (Module 2 screens, UI Design §5)
    │   └── student/           # Registration screen with Category/Department dropdowns (UI Design §4.1)
    └── services/
        └── api/               # Typed client for contracts/openapi.yaml
```

**Structure Decision**: Mobile + API layout. The API (`api/`) is the primary deliverable of this feature — it owns the tenant/role/master-data/user invariants and is the reusable, client-agnostic contract. The System Admin Portal is implemented as a role-gated section of the same React Native codebase (`mobile/src/screens/system-admin`) rather than a separate web app (research.md §7), consistent with BRD Assumption 2's single-shared-codebase approach; this can be revisited later without changing the API contracts above, since `contracts/openapi.yaml` does not assume any particular client.

## Complexity Tracking

*No Constitution Check violations — this section is intentionally empty.*
