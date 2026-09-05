# Implementation Plan: Resume Payment on a Pending Order

**Branch**: `010-resume-pending-order-payment` | **Date**: 2026-09-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-resume-pending-order-payment/spec.md`

## Summary

Amend `006-student-browse-cart-checkout` so a student stuck in `payment_pending` (not just `payment_failed`) can resume payment on the exact same order via a widened eligibility check on the existing retry-payment endpoint, and amend `008-my-orders-history-upcoming`'s Order Detail to show an actionable "payment in progress" prompt for that status (closing UI Design §4.14's gap). The core engineering problem this plan solves is correctness under concurrent payment attempts: a naive "just overwrite the gateway reference and retry" implementation would let a late-arriving confirmation for a superseded attempt either get silently dropped (losing a real successful payment) or wrongly finalize an order that a newer attempt should still be allowed to complete. This plan introduces a `payment_attempts` table and an asymmetric success/failure reconciliation rule (research.md §1-§2) to close both failure modes without touching `006`'s order-level idempotency guard, which remains the single source of truth for "an order is finalized at most once."

## Technical Context

**Language/Version**: TypeScript (Node.js 20 LTS) for the API — unchanged from prior features

**Primary Dependencies**: NestJS (reused); no new external dependency — this is additional schema plus a change to existing service logic inside `006`'s `student-orders`/`payments` modules

**Storage**: Supabase-managed PostgreSQL — one new table, `payment_attempts` (RLS-scoped via the owning order, no `system_admin` bypass); `orders.payment_gateway_ref` retained but repurposed as a denormalized pointer, not the webhook lookup key (data-model.md)

**Testing**: Jest + Supertest extending `006`'s existing payment-webhook test suite with the race-condition scenarios from `quickstart.md` (stale success honored, stale failure ignored) as first-class test cases — these are the highest-value tests in this feature, since they validate the actual bug being fixed, not just the widened-eligibility happy path

**Target Platform**: Same containerized Node.js API as prior features; mobile changes limited to rendering `008`'s existing Order Detail screen's `payment_pending` case (a "payment in progress" banner + Resume Payment button wired to the same retry-payment call already used for `payment_failed`)

**Performance Goals**: Same <300ms perceived-latency NFR; the webhook's reconciliation query (attempt lookup + conditional order update) remains a small number of indexed single-row operations, no change to `006`'s existing performance characteristics

**Constraints**: A success confirmation MUST always be honored (finalizing the order) regardless of which attempt it's for, as long as the order hasn't already been finalized (research.md §2); a failure confirmation MUST only finalize the order when it's for the *current* attempt (research.md §2); at most one `payment_attempts` row per order may be `is_current = true` at any time (enforced by a partial unique index, data-model.md §1)

**Scale/Scope**: Same tenant/user scale as prior features; the number of attempts per order is expected to be very small (1-3 in the overwhelming majority of cases), so no special indexing/partitioning beyond the standard per-order lookup is warranted

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

As in prior features, `.specify/memory/constitution.md` remains an unfilled template; `docs/ui-screen/06-UI-Design.md` §4.14 and the BRD/Architecture's existing "no duplicate order" and "webhook-only finalization" rules (already governing `006`) govern this feature directly. Checked against those:

- "Payment in progress" + Resume Payment for `payment_pending` orders, matching UI Design §4.14 exactly. ✅
- No duplicate order ever created from a resume action (BRD Business Rule 5, extended here to the payment-pending case). ✅
- Order status still finalized only by the server-side webhook, never a client signal — this plan's changes are entirely on the webhook-reconciliation side, not a new client-trusted finalization path (Architecture §7's "critical design rule," preserved). ✅
- No new cross-tenant/cross-account access — `payment_attempts` RLS is derived entirely from the owning order's existing visibility rules (`006`/`004`/`005` precedent of not adding unauthorized access). ✅

**Result**: PASS. No entries required in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/010-resume-pending-order-payment/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── openapi.yaml      # Phase 1 output (/speckit-plan command) — amendment to 006's contract
└── tasks.md               # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

No new module. Modifies `006`'s `student-orders` and `payments` modules only.

```text
api/
├── src/
│   ├── student-orders/
│   │   └── student-orders.service.ts   # (006, modified) — retry-payment eligibility widened to payment_pending; creates a new payment_attempts row, marks prior non-current
│   └── payments/
│       └── payments.service.ts          # (006, modified) — webhook reconciliation now looks up payment_attempts by gateway_ref and applies the asymmetric success/failure rule (research.md §2)
├── migrations/
│   └── ...                               # payment_attempts table + RLS (data-model.md)
└── test/
    └── webhook/
        └── payments-webhook/               # (006, extended) — new cases: resume-from-pending happy path, stale-success-honored, stale-failure-ignored (quickstart.md Scenarios 1, 3, 4)

mobile/
└── src/
    └── screens/
        └── student/
            └── OrderDetail.tsx              # (006/008, extended) — payment_pending case: "Payment in progress" banner + Resume Payment button, calling the same retry-payment endpoint already wired for Pay Again
```

**Structure Decision**: No new module — this is a targeted, correctness-focused amendment to `006`'s existing `student-orders`/`payments` modules, following the same "extend, don't duplicate" pattern `008`, `009`, and this feature's own spec Assumption already established.

## Complexity Tracking

*No Constitution Check violations — this section is intentionally empty.*
