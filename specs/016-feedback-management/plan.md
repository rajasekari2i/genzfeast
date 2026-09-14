# Implementation Plan: Feedback Management

**Branch**: `016-feedback-management` | **Date**: 2026-09-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/016-feedback-management/spec.md`

## Summary

Add a tenant-scoped `feedback` table and two surfaces on top of it: a submit-only Feedback page reachable by any authenticated tenant role (Student, Teaching, Non-Teaching, Company Staff, Company Admin) via `POST /me/feedback`, and a Company-Admin-only review queue (`GET/PATCH /tenant/feedback...`) to list, inspect, and resolve submissions. This is additive to the existing schema — no changes to `companies`/`users`/any prior table — and reuses every already-established platform mechanism rather than inventing new ones: `TenantPrismaService`'s RLS session-variable pattern (§4.3 of `coding_standard.md`) for tenant isolation, `011`'s generic `fn_audit_log()` trigger for auditability (extended to a fourth table), and the `created_by`/`updated_by`/`is_deleted` conventions every other tenant-scoped table already carries.

## Technical Context

**Language/Version**: TypeScript (Node.js 20 LTS) for the API — unchanged from prior features

**Primary Dependencies**: NestJS (reused); `class-validator` for DTO validation (`@IsInt() @Min(1) @Max(5)` for rating, `@IsIn([...])` for category, `@IsString() @MaxLength(1000)` for message); Prisma (reused)

**Storage**: Supabase-managed PostgreSQL — one new table, `feedback` (data-model.md), with RLS and the existing `fn_audit_log()` trigger attached; no changes to any existing table

**Testing**: Jest + Supertest for `/me/feedback` and `/tenant/feedback...` contract tests (role-gated submit, tenant-scoped list/detail, resolve transition, cross-tenant rejection) — per this project's stated workflow, tests are written as a follow-up once implementation is done, not proactively mid-implementation

**Target Platform**: Same containerized Node.js API as prior features; mobile screens are new — no existing entry in `docs/ui-screen/06-UI-Design.md` covers Feedback yet (confirmed by inspection; this feature is the first to define these screens)

**Performance Goals**: Same <300ms perceived-latency NFR as every other screen; no new performance-sensitive path (feedback is low-frequency, not on the order/payment hot path)

**Constraints**: Every feedback record MUST be tagged with the submitter's own `company_id` from the verified JWT, never a client-supplied value (FR-006); Category and Message MUST be required, Rating and "Contact me back" MUST remain optional (FR-002–FR-004, FR-007); only `company_admin` MUST be able to transition a record's status, and only `new → resolved` (FR-013/FR-014, one-way); cross-tenant access MUST be rejected at both the API and RLS layers (FR-015)

**Scale/Scope**: Same tenant/user scale as prior features; low write frequency (one row per submission, no batch operations), simple two-state lifecycle — smallest-scope feature in this codebase alongside `007`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

As with every prior feature, `.specify/memory/constitution.md` remains an unfilled template; per CLAUDE.md's own stated fallback, `docs/architecture/04-Architecture.md` §6 (Multi-Tenant Isolation Strategy) and `docs/product/01-BRD.md` §8–§9 (Business Rules, Risks) govern this feature's Constitution Check, together with this repo's own `coding_standard.md` (binding on top of the docs per CLAUDE.md). Checked against those:

- Every tenant-scoped table isolated two ways simultaneously — API-layer `company_id` filtering from the verified JWT, plus independent Postgres RLS (CLAUDE.md Multi-Tenancy; Architecture §6). ✅ — `feedback` gets both (data-model.md).
- No blanket `BYPASSRLS`; any `system_admin` cross-tenant reach must be a narrow RLS predicate, granted only when a spec's FRs explicitly call for it (CLAUDE.md; `coding_standard.md` §5.3). This spec grants System Admin **no** access to feedback at all (spec Assumptions: system_admin is excluded from this feature entirely) — so the correct RLS policy has **no** system_admin predicate, matching `004`'s Products precedent exactly. ✅
- `company_id`/`role`/`user id` for authorization come only from the verified JWT (`@CurrentUser()`), never a request body/path value (`coding_standard.md` §3, §5.1). ✅ — `POST /me/feedback`'s `company_id` is never client-supplied (contracts/openapi.yaml).
- Soft delete only, never hard-delete; standard `created_by`/`updated_by`/`created_at`/`updated_at` audit columns on every table (CLAUDE.md Data Conventions). ✅
- Auditability: business-critical table mutations recorded via DB trigger, not application code (CLAUDE.md; `coding_standard.md` §8). `feedback` is extended to use `011`'s existing `fn_audit_log()` trigger (research.md §2) rather than inventing a parallel logging mechanism. ✅
- No new roles invented; the fixed role set (CLAUDE.md Roles table) is used as-is — Company Staff can submit feedback but is deliberately excluded from the review/resolve surface, matching the user's explicit description, the same way `004` restricts Staff to sold-out-toggle only. ✅

**Result**: PASS. No entries required in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/016-feedback-management/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── openapi.yaml      # Phase 1 output (/speckit-plan command)
└── tasks.md               # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

This repo already has real `api/` and `mobile/` source trees (not spec-only, despite CLAUDE.md's stale "no application source code exists yet" note — flagging that mismatch here rather than silently trusting it). This feature adds one new API module and follows the exact folder conventions already used by `products`/`profile`, plus screens under the existing `mobile/src/screens/shared/` (any-role) and `mobile/src/screens/tenant-admin-staff/` (Company-Admin-only) trees — it does not need `mobile/src/screens/student/` (Student is just one of several roles this page serves) or a new top-level screens folder.

```text
api/
├── prisma/
│   ├── schema.prisma          # add `model Feedback` (data-model.md)
│   └── migrations/
│       └── <timestamp>_feedback/
│           └── migration.sql   # Prisma-generated CREATE TABLE + hand-added CHECK/index/GRANT/RLS/trigger (data-model.md)
├── src/
│   └── feedback/
│       ├── feedback.module.ts
│       ├── feedback.controller.ts    # POST /me/feedback; GET/PATCH /tenant/feedback... (contracts/openapi.yaml)
│       ├── feedback.service.ts        # create, list (tenant-scoped + status filter), get-one, resolve
│       ├── feedback.mapper.ts          # entity -> response DTO; only attaches contact_email when contact_requested=true (research.md §3)
│       └── dto/
│           ├── create-feedback.dto.ts
│           └── list-feedback-query.dto.ts
└── test/
    └── contract/
        └── feedback/                   # role-gated submit, tenant-scoped list/detail, resolve transition, cross-tenant rejection

mobile/
└── src/
    └── screens/
        ├── shared/
        │   └── FeedbackScreen.tsx        # rating, category, message, contact-me-back, submit — reachable by every role (spec User Story 1)
        └── tenant-admin-staff/
            ├── FeedbackListScreen.tsx     # Company Admin only — status filter (spec User Story 2)
            └── FeedbackDetailScreen.tsx   # Company Admin only — full detail + Resolve action (spec User Story 3)
```

**Structure Decision**: A single small `feedback/` API module, matching `007`'s precedent for a feature with one new table and a handful of endpoints — no split into submit/review sub-modules, since both sides share the same entity, service, and mapper, and the only boundary that matters (who may call which endpoint) is already expressed via `@Roles(...)` guards on individual routes, not via module boundaries. On the mobile side, the submission screen goes under `shared/` (it's the same screen regardless of caller role) while the two review screens go under `tenant-admin-staff/` (Company-Admin-only), mirroring how `007` split `ProfileScreen`/`EditProfile`/`ChangePassword` into `shared/` while `004`'s Product management screens live in `tenant-admin-staff/`.

## Complexity Tracking

*No Constitution Check violations — this section is intentionally empty.*
