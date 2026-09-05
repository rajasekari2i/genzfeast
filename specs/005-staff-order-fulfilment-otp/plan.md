# Implementation Plan: Staff Order Fulfilment (Incoming Orders & OTP Verification)

**Branch**: `005-staff-order-fulfilment-otp` | **Date**: 2026-09-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-staff-order-fulfilment-otp/spec.md`

## Summary

Give the Staff role a counter-facing workflow on top of `001`'s tenant/user model: a filtered list of a Company's `order_placed` orders ("incoming"), an order-detail view, and a code-verification action that — on a match — transitions the order to `delivered` and records a `deliveries` row, or — on a mismatch — leaves everything unchanged with an unlimited-retry, fully-audited error path. This feature deliberately does not own the `orders` table's full lifecycle (creation, payment, code generation are a future Checkout & Payment feature's responsibility); it specifies only the columns it depends on as a consumer contract, and fully owns two new tables it does control: `deliveries` and `order_audit_logs`.

## Technical Context

**Language/Version**: TypeScript (Node.js 20 LTS) for the API — unchanged from prior features

**Primary Dependencies**: NestJS (reused); no new external dependency — this feature is pure business logic plus two new tables over the existing Postgres/RLS baseline

**Storage**: Supabase-managed PostgreSQL — two new tables (`deliveries`, `order_audit_logs`), RLS-enabled, no `system_admin` bypass (research.md, data-model.md); depends on but does not migrate an `orders` table owned elsewhere

**Testing**: Jest + Supertest for `/tenant/staff/orders*` contract tests (incoming-list filtering by status, cross-tenant denial, verify success/mismatch/already-delivered, pickup-code-never-in-response assertion); tests seed `orders` fixtures directly rather than exercising a real checkout flow, since that flow doesn't exist yet

**Target Platform**: Same containerized Node.js API as prior features; mobile screens per UI Design §5.6 (Incoming Orders) and §5.7 (Order Fulfilment)

**Performance Goals**: Same <300ms perceived-latency NFR; the incoming-orders list should reflect a newly placed order through normal app use (SC-001) — the specific refresh mechanism (polling interval, push-triggered refetch) is a client implementation detail, not a spec-level constraint

**Constraints**: The pickup code MUST NEVER appear in any Staff-facing API response (FR-009) — this is a response-shaping rule to enforce in code review/tests, not just a UI-hiding convention; a code MUST be rejectable an unlimited number of times without any lockout (FR-012, a deliberate absence, not an oversight); a delivered order MUST be un-re-deliverable (`UNIQUE (order_id)` on `deliveries`, data-model.md §1)

**Scale/Scope**: Same tenant/user scale as prior features; order volume during peak canteen hours (break/lunch) is the platform's actual concurrency stress point per BRD's own problem statement, so the incoming-list query and verify endpoint should be simple, indexed, single-row operations rather than anything join-heavy

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

As in prior features, `.specify/memory/constitution.md` remains an unfilled template; `docs/product/02-PRD.md` §FR-3/§FR-9 and `docs/architecture/04-Architecture.md` §8 govern this feature directly. Checked against those:

- Staff can view incoming orders and verify OTP to complete delivery, matching FR-3.2/FR-3.3/FR-9.1/FR-9.2 exactly. ✅
- OTP mismatch shows inline error, no state change, retry allowed (FR-3.4/FR-9.3). ✅
- Order status change writes an auditable record (Architecture §7's "every status transition writes an audit_logs row" principle — implemented here via the dedicated `order_audit_logs` table, research.md §3). ✅
- No new payment/OTP-generation logic introduced — this feature strictly consumes an already-placed order (BRD §5 scope: "Staff: sold-out toggle, order fulfilment via OTP" — fulfilment only). ✅
- Tenant isolation maintained: no Staff or System Admin cross-tenant access introduced (BRD §9 risk). ✅

**Result**: PASS. No entries required in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/005-staff-order-fulfilment-otp/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── openapi.yaml      # Phase 1 output (/speckit-plan command)
└── tasks.md               # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

Extends the `api/` structure from prior features. Adds a `staff-orders/` module; does not modify `products/`, `auth/`, or `001`'s modules.

```text
api/
├── src/
│   ├── staff-orders/
│   │   ├── staff-orders.controller.ts   # GET /tenant/staff/orders, GET .../:id, POST .../:id/verify
│   │   ├── staff-orders.service.ts       # incoming-list filter (status=order_placed), code comparison, delivery creation
│   │   └── order-audit.service.ts        # writes order_audit_logs (research.md §3)
│   └── common/
│       └── guards/
│           └── roles.guard.ts             # (reused) — restricts this module's routes to the `staff` role
├── migrations/
│   └── ...                                 # deliveries, order_audit_logs tables + RLS (data-model.md)
└── test/
    ├── contract/
    │   └── staff-orders/                   # incoming-list, verify success/mismatch/already-delivered, response-shape (no-otp) tests
    └── fixtures/
        └── orders.ts                        # seeds orders rows directly, standing in for the not-yet-built checkout flow

mobile/
└── src/
    └── screens/
        └── staff/
            ├── IncomingOrders.tsx            # UI Design §5.6 — order id, item count, total, time placed
            └── OrderFulfilment.tsx            # UI Design §5.7 — item/total detail, OTP input, Verify & Deliver button, mismatch inline error
```

**Structure Decision**: A new `staff-orders/` module, separate from `004`'s `products/` module, since this is a distinct bounded concern (order fulfilment, not product catalog management) with its own new tables and its own single-role (`staff`) authorization shape, following the one-module-per-concern convention established since `001`.

## Complexity Tracking

*No Constitution Check violations — this section is intentionally empty.*
