# Implementation Plan: Company Admin Product Management

**Branch**: `004-company-admin-product-crud` | **Date**: 2026-09-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-company-admin-product-crud/spec.md`

## Summary

Add Product CRUD scoped to a Company Admin's own tenant, on top of `001`'s `companies`/`users` schema: create (Name, Description, Price, Veg/Non-Veg required; photo optional), full edit (partial updates, unaffected fields untouched), a sold-out toggle shared with the Staff role but kept as its own write path independent of full edit, and soft-delete removal that never breaks a future Order's historical reference. One new table (`products`), no changes to existing tables. A drafting inconsistency caught during planning — the spec had implied System Admin held cross-tenant Product access, which no prior spec actually grants — was corrected in `spec.md` before design proceeded; this plan reflects the corrected, Company-scoped-only access model.

## Technical Context

**Language/Version**: TypeScript (Node.js 20 LTS) for the API — unchanged from `001`/`002`/`003`

**Primary Dependencies**: NestJS (reused); Supabase Storage client for product photo upload (research.md §1); `class-validator`/`class-transformer` for DTOs, including the `price > 0` and required-field rules

**Storage**: Supabase-managed PostgreSQL — one new table, `products`, RLS-enabled; Supabase Storage for photo binaries (only `image_url` lives in Postgres)

**Testing**: Jest + Supertest for `/tenant/products*` contract tests (create validation, partial-update field isolation, sold-out-toggle-as-Staff, cross-tenant denial, soft-delete-then-edit-rejected); an RLS-only test confirming no `system_admin` bypass exists on `products` (research.md §2), since that absence is a deliberate security property worth testing directly, not just implying

**Target Platform**: Same containerized Node.js API as prior features; mobile screens per UI Design §5.2/§5.3 (Product List, Product Create/Edit)

**Performance Goals**: Same <300ms perceived-latency NFR as the rest of the platform; image upload is the one operation here likely to exceed that budget and should be treated as an async/progress-indicated action client-side (a UI concern, not a spec-level constraint)

**Constraints**: `price` MUST be enforced `> 0` at both the API and database layer (`CHECK` constraint, data-model.md §1); the sold-out toggle MUST remain reachable by Staff without granting Staff any other product-write capability; no Product data MUST cross company boundaries, and — per the corrected FR-003 — System Admin gets no special-cased exception to that rule in this feature

**Scale/Scope**: Same tenant/user scale as prior features; a canteen's menu is expected to be tens to low hundreds of products, not a high-cardinality catalog

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

As in `001`/`002`/`003`, `.specify/memory/constitution.md` remains an unfilled template; `docs/product/02-PRD.md` §FR-2.3/FR-3.1 and `docs/architecture/04-Architecture.md` §1/§6/§10 govern this feature directly. Checked against those:

- Product images stored in Supabase Storage, not as a database blob (Architecture §1). ✅
- Tenant isolation enforced via `company_id` scoping + RLS, no exceptions introduced beyond what's authorized (BRD §9 risk, corrected FR-003). ✅
- Soft delete only, `is_deleted` flag, consistent with the platform-wide auditability/traceability NFR (PRD §4). ✅
- `created_by`/`updated_by`/`created_at`/`updated_at` present on the new table (PRD §4 NFR). ✅
- No new Firebase/Supabase service introduced beyond what's already approved. ✅

**Result**: PASS. No entries required in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/004-company-admin-product-crud/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── openapi.yaml      # Phase 1 output (/speckit-plan command)
└── tasks.md               # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

Extends the `api/` structure from `001`. No new top-level directories; adds a `products/` module alongside `001`'s `companies/roles/categories/departments/users` modules and `002`'s `auth/`.

```text
api/
├── src/
│   ├── products/
│   │   ├── products.controller.ts   # GET/POST /tenant/products, PATCH/DELETE /tenant/products/:id, PATCH .../soldout, POST .../image
│   │   ├── products.service.ts       # validation (name/price required, price>0), partial-update field isolation, soft-delete
│   │   └── product-image.service.ts  # Supabase Storage upload, returns image_url (research.md §1)
│   └── common/
│       └── guards/
│           └── roles.guard.ts         # (reused/extended from 001/002) — company_admin for full CRUD, company_admin|staff for soldout toggle
├── migrations/
│   └── ...                             # products table + RLS policies (data-model.md)
└── test/
    ├── contract/
    │   └── products/                   # create/update/soldout/delete/cross-tenant contract tests
    └── rls/
        └── products-no-admin-bypass.test  # explicit test that system_admin has no special access here

mobile/
└── src/
    └── screens/
        └── tenant-admin/
            ├── ProductList.tsx          # UI Design §5.2 — image thumb, name, price, veg/non-veg icon, sold-out toggle switch, edit icon, + Add Product FAB
            └── ProductCreateEdit.tsx     # UI Design §5.3 — Name, Description, Image, Price, Is Veg
```

**Structure Decision**: Product logic lives in its own `api/src/products/` module rather than folding into `001`'s `companies/` module — Products are a distinct entity with their own lifecycle (soft-delete, sold-out) and a genuinely different authorization shape (split Company-Admin-vs-Staff access on one sub-operation), which is enough separation of concern to warrant its own module per the one-module-per-concern convention `001` established.

## Complexity Tracking

*No Constitution Check violations — this section is intentionally empty.*
