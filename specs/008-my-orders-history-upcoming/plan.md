# Implementation Plan: My Orders — History & Upcoming Orders

**Branch**: `008-my-orders-history-upcoming` | **Date**: 2026-09-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-my-orders-history-upcoming/spec.md`

## Summary

Organize a student's existing orders (owned by `006-student-browse-cart-checkout`) into two filtered, sorted views — Upcoming (`payment_pending`/`order_placed`) and History (`delivered`/`payment_failed`/unreachable-in-V1 `cancelled`) — and complete the Order Detail response with a `delivered_at` field so the client can show exactly the right status-specific content (pickup code, delivered time, or Pay Again) from `status` alone. Like `007`, this feature requires **no new table, no migration, and no new RLS policy** — it extends `006`'s existing `GET /student/orders` with a `view` query parameter and its `OrderDetail` schema with one additional field.

## Technical Context

**Language/Version**: TypeScript (Node.js 20 LTS) for the API — unchanged from prior features

**Primary Dependencies**: NestJS (reused) — no new external dependency; this is a query-filter and response-shaping change inside `006`'s existing `student-orders` module

**Storage**: Supabase-managed PostgreSQL — no schema changes; adds a `WHERE status IN (...)` filter and `ORDER BY created_at DESC` to an existing query, and includes an already-existing column (`delivered_at`) in an existing response (data-model.md)

**Testing**: Jest + Supertest extending `006`'s existing `student-orders` contract tests with `view=upcoming`/`view=history` filter-correctness cases and an `OrderDetail` response-shape test per status (`order_placed`/`delivered`/`payment_failed`/`payment_pending`)

**Target Platform**: Same containerized Node.js API as prior features; mobile screens per UI Design §4.13 (My Orders list with Upcoming/History tabs) and the existing Order Detail screen from `006`, now extended

**Performance Goals**: Same <300ms perceived-latency NFR; both filtered queries remain simple, already-`user_id`-scoped, indexed lookups — no new performance concern

**Constraints**: The `view` filter MUST be additive — omitting it MUST preserve `006`'s original unfiltered behavior exactly (research.md §1); `delivered_at` and `otp` MUST never both be populated for the same order at the same time (mutually exclusive by construction, since `otp` is cleared/ignored once `delivered_at` is set — verified by `006`/`005`'s existing state machine, not newly enforced here)

**Scale/Scope**: Same tenant/user scale as prior features; per-student order volume is small (a few to a few dozen), so no pagination mechanism is mandated by this plan (spec Assumption defers it)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

As in prior features, `.specify/memory/constitution.md` remains an unfilled template; `docs/product/02-PRD.md` §FR-11 and `docs/ui-screen/06-UI-Design.md` §4.13 govern this feature directly. Checked against those:

- Upcoming/History split matches FR-11.1's exact status groupings. ✅
- Order Detail shows itemized snapshot, total, status, and status-specific content per FR-11.2. ✅
- Item snapshot immutability (FR-11.3) already guaranteed by `006`; unaffected by this feature. ✅
- Pickup OTP exposure rule (FR-11.4) already enforced by `006`; reaffirmed, not reimplemented. ✅
- No new tenant-isolation surface introduced — reuses `006`'s existing ownership-scoped RLS unchanged. ✅

**Result**: PASS. No entries required in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/008-my-orders-history-upcoming/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── openapi.yaml      # Phase 1 output (/speckit-plan command)
└── tasks.md               # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

No new module. This feature modifies `006`'s existing `student-orders` module only.

```text
api/
├── src/
│   └── student-orders/
│       ├── student-orders.controller.ts   # (006, modified) — GET /student/orders accepts ?view=
│       └── student-orders.service.ts        # (006, modified) — status-IN filter + created_at DESC sort; OrderDetail now includes delivered_at
└── test/
    └── contract/
        └── student-orders/                   # (006, extended) — view-filter correctness, per-status OrderDetail shape

mobile/
└── src/
    └── screens/
        └── student/
            ├── MyOrders.tsx                    # UI Design §4.13 — Upcoming/History tabs, card list
            └── OrderDetail.tsx                  # (006, extended) — status-conditional rendering: OTP | delivered time | Pay Again
```

**Structure Decision**: No new module — this is a targeted extension of `006`'s `student-orders` module (one query-parameter addition, one response-field addition), not a new bounded concern warranting its own module.

## Complexity Tracking

*No Constitution Check violations — this section is intentionally empty.*
