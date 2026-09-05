# Implementation Plan: Audit Trail for Product, Order & Payment Changes

**Branch**: `011-audit-logs-product-order-payment` | **Date**: 2026-09-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-audit-logs-product-order-payment/spec.md`

## Summary

Build the generic, trigger-based `audit_logs` mechanism Architecture §7/§10 and BRD Assumption 8 have referenced since `001` but no feature ever actually designed — scoped exactly to `products` (`004`), `orders` (`006`), and `payment_attempts` (`010`), per the explicit request. One table, one table-agnostic PL/pgSQL trigger function attached to all three tables, an immutable append-only design enforced by revoked `UPDATE`/`DELETE` privileges (not just the absence of an API), and an actor-resolution convention (`app.current_user_id` or `app.current_system_actor`) that guarantees every record names who or what made the change — reusing the same session-variable mechanism `001` already established for tenant scoping rather than inventing a new plumbing concept. This feature has no HTTP endpoints and no viewing UI; it is pure database infrastructure that every future write to these three tables benefits from automatically.

## Technical Context

**Language/Version**: SQL/PL-pgSQL for the trigger function; TypeScript (Node.js 20 LTS) only insofar as `006`'s webhook handler needs one line added to set `app.current_system_actor` before its writes (no new API-layer code otherwise)

**Primary Dependencies**: None new — this is pure PostgreSQL (trigger, function, revoked grants) on the existing Supabase-managed database

**Storage**: Supabase-managed PostgreSQL — one new table, `audit_logs`, RLS-enabled with no application-role `SELECT` policy (data-model.md); a trigger function attached to three existing tables with no changes to their own columns

**Testing**: A SQL-level test suite (or Jest tests driving real DB transactions) exercising each of the three tables' create/update/soft-delete paths and asserting the resulting `audit_logs` rows match expectations (`quickstart.md`); a dedicated privilege test confirming the application's DB role cannot `UPDATE`/`DELETE` `audit_logs` under any circumstance

**Target Platform**: Same Supabase-managed PostgreSQL instance as every other feature; no client-side or mobile changes at all

**Performance Goals**: The trigger adds one small `INSERT` per row-level `INSERT`/`UPDATE` on three already-write-light tables (Products change routinely but not at high frequency; Orders and payment attempts are naturally rate-limited by real checkout volume) — no measurable impact expected on the platform's existing <300ms perceived-latency NFR

**Constraints**: Every write path to `products`, `orders`, or `payment_attempts` MUST set exactly one of `app.current_user_id` / `app.current_system_actor` before writing, or the audit record's `CHECK` constraint will reject the insert and the underlying write will fail inside the same transaction — this is a deliberate hard failure (fail loud) rather than allowing a silently blank-actor audit record to be written; `UPDATE`/`DELETE` on `audit_logs` MUST be impossible for the application's own database role, not merely unexposed via API

**Scale/Scope**: Same tenant/user scale as prior features; `audit_logs` is expected to grow steadily and indefinitely (no retention/purge policy per spec Assumption) — worth flagging for future storage-cost monitoring, though not a concern at this platform's stated scale (a handful to low tens of tenants)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

As in prior features, `.specify/memory/constitution.md` remains an unfilled template; `docs/product/01-BRD.md` Assumption 8 and `docs/architecture/04-Architecture.md` §7/§10 govern this feature directly — this plan exists specifically to implement what those sections describe. Checked against those:

- Every mutation of the three named business-critical tables is recorded via a database trigger, not application code remembering to log (BRD Assumption 8, Architecture §10's explicit wording). ✅
- Every order status transition writes an audit row (Architecture §7's "every status transition also writes an audit_logs row automatically via the Postgres trigger" — this plan is the first to actually build that trigger). ✅
- No new cross-tenant access introduced — `audit_logs` has no application-role read policy at all, the strictest possible posture (`004`/`005`/`006`/`010` precedent of never adding unauthorized access). ✅

**Result**: PASS. No entries required in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/011-audit-logs-product-order-payment/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
└── quickstart.md         # Phase 1 output (/speckit-plan command)
```

No `contracts/` directory — this feature exposes no HTTP interface of any kind (pure database trigger infrastructure), consistent with the plan template's own instruction to skip contracts for a purely internal capability.

### Source Code (repository root)

No new module. Adds one migration and touches `006`'s webhook handler with a one-line addition.

```text
api/
├── migrations/
│   └── ...                              # audit_logs table, fn_audit_log() trigger function, three CREATE TRIGGER statements, REVOKE UPDATE/DELETE grants (data-model.md)
└── src/
    └── payments/
        └── payments.service.ts           # (006, modified) — one addition: SET LOCAL app.current_system_actor = 'payment_webhook' before its order/payment_attempts writes (research.md §4)

test/
└── db/
    └── audit-log/                        # trigger-behavior tests per quickstart.md: create/update/soft-delete diffing, actor resolution, immutability privilege check
```

**Structure Decision**: No application module — the entire feature lives in the database layer (one migration) plus a single-line addition to `006`'s existing webhook code to establish the "system actor" session variable it was previously never setting. No new source directory is warranted for a capability with no application-level behavior of its own beyond that one line.

## Complexity Tracking

*No Constitution Check violations — this section is intentionally empty.*
