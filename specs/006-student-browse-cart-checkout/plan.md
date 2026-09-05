# Implementation Plan: Browse, Cart & Checkout with Payment

**Branch**: `006-student-browse-cart-checkout` | **Date**: 2026-09-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-student-browse-cart-checkout/spec.md`

## Summary

Give the Student role a full browse-to-paid-order journey on top of `001` (users/companies), `002` (auth), and `004` (products): a read-only product feed, a purely client-side cart (no server cart entity), and an order-placement flow that re-validates availability and re-derives price server-side before creating an immutable order snapshot. Payment integrates with Razorpay (UPI-only): the order is finalized `payment_pending → order_placed`/`payment_failed` only by a server-verified, idempotent webhook, never a client redirect. This feature **fully defines and migrates `orders`** — the table `005-staff-order-fulfilment-otp` declared as a dependency contract without owning — closing that loop with role-conditional RLS (students see only their own orders; Staff/Company Admin see their whole company's, matching `005`'s expectations).

## Technical Context

**Language/Version**: TypeScript (Node.js 20 LTS) for the API — unchanged from prior features

**Primary Dependencies**: NestJS (reused); Razorpay Node SDK (or direct REST calls) for opening a payment session and verifying webhook signatures (research.md §4/§5); `class-validator`/`class-transformer` for DTOs

**Storage**: Supabase-managed PostgreSQL — one new table, `orders` (fully defined here, satisfying `005`'s dependency contract), RLS-enabled with role-conditional policies (data-model.md); no cart table (research.md §1)

**Testing**: Jest + Supertest for `/student/products`, `/student/orders*` contract tests (availability re-validation, price non-trust, one-active-order enforcement, cross-tenant/cross-student denial) plus a dedicated webhook test suite (signature rejection, idempotent replay, success/failure transitions) — the webhook path is the highest-risk surface in this feature and warrants its own focused coverage beyond generic contract tests

**Target Platform**: Same containerized Node.js API as prior features; mobile screens per UI Design §3–§4 (Home/Product List, Cart, Order Success/Failed)

**Performance Goals**: Same <300ms perceived-latency NFR for browsing/cart interactions (PRD §4 NFR: "Product list and cart interactions should feel instant... using local/optimistic state before syncing to backend") — directly consistent with the cart being client-side (research.md §1); the order-placement and webhook endpoints are not subject to this budget since they involve real payment-gateway round trips

**Constraints**: Price/name for a placed order MUST always be derived server-side from live product data, never accepted from the client (research.md §2); an order's finalization MUST come only from a verified gateway webhook (FR-011); a student MUST never have more than one `payment_pending`/`payment_failed` order at a time (FR-016, enforced by a DB constraint, not just application logic); no order-cancellation endpoint of any kind exists (FR-021)

**Scale/Scope**: Same tenant/user scale as prior features; order volume peaks sharply during class-break windows per BRD's own problem statement, so the placement and webhook paths should avoid unnecessary locking/joins beyond what the unique-constraint check (research.md §3) requires

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

As in prior features, `.specify/memory/constitution.md` remains an unfilled template; `docs/product/02-PRD.md` §FR-6/§FR-7/§FR-8, `docs/product/01-BRD.md` §5/§7/§8, and `docs/architecture/04-Architecture.md` §7 govern this feature directly. Checked against those:

- Order status finalized only by server-side webhook, never client redirect (Architecture §7's explicit "critical design rule," BRD §9 risk row). ✅
- Payment restricted to Razorpay, UPI-only (BRD Assumption 4). ✅
- Pickup OTP generated once, at payment success, single-use, invalidated at delivery (BRD Business Rule 4 — the "invalidated at delivery" half is `005`'s concern; this feature only generates it). ✅
- Failed payment never creates a duplicate order (BRD Business Rule 5). ✅
- Fulfilment fixed to Canteen Pickup, no address capture (BRD §5 scope, PRD FR-7.4). ✅
- Order line items snapshot name/price at placement time, immutable thereafter (platform-wide auditability/traceability NFR). ✅
- Tenant isolation maintained via role-conditional RLS, no new unauthorized cross-tenant reach introduced (BRD §9 risk, `004`/`005` precedent). ✅

**Result**: PASS. No entries required in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/006-student-browse-cart-checkout/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── openapi.yaml      # Phase 1 output (/speckit-plan command)
└── tasks.md               # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

Extends the `api/` structure from prior features. Adds a `student-orders/` module and a `payments/` module; does not modify `products/`, `auth/`, or `001`'s modules. `005`'s `staff-orders/` module remains separate and now reads the `orders` table this feature creates.

```text
api/
├── src/
│   ├── student-orders/
│   │   ├── student-orders.controller.ts   # GET /student/products, GET/POST /student/orders, GET .../:id, POST .../:id/retry-payment
│   │   ├── student-orders.service.ts       # availability re-validation, server-side price snapshot, one-active-order check
│   │   └── order-audit.service.ts          # writes order_audit_logs (shared shape with 005's, new event types: order_created, payment_succeeded, payment_failed)
│   ├── payments/
│   │   ├── payments.controller.ts           # POST /payments/webhook
│   │   ├── razorpay.service.ts               # open payment session, verify webhook signature (research.md §4)
│   │   └── payments.service.ts                # idempotent status-transition logic (research.md §5)
│   └── common/
│       └── guards/
│           └── roles.guard.ts                 # (reused) — student-only for /student/*, signature-verified (not JWT) for the webhook
├── migrations/
│   └── ...                                     # orders table + role-conditional RLS (data-model.md)
└── test/
    ├── contract/
    │   └── student-orders/                     # browse, place-order validation/price-trust, one-active-order, cross-tenant/cross-student denial
    └── webhook/
        └── payments-webhook/                    # signature rejection, idempotent replay, success/failure transitions

mobile/
└── src/
    └── screens/
        └── student/
            ├── Home.tsx                          # UI Design §4 — product cards, ADD+ control, persistent "N item(s) added" bar
            ├── Cart.tsx                            # cart lines, +/- controls, Total Amount, payment method selector, Place Order
            └── OrderConfirmation.tsx                # "Order Placed Successfully" + OTP, or "Payment Failed" + Pay Again
```

**Structure Decision**: Two new modules — `student-orders/` (the student-facing browse/cart/order surface) and `payments/` (gateway integration, isolated because it has a fundamentally different trust boundary: signature-verified, not JWT-authenticated, and callable by an external service rather than the mobile client). Keeping payments separate from `student-orders` means the webhook's security model doesn't get accidentally blended with the student-facing route guards.

## Complexity Tracking

*No Constitution Check violations — this section is intentionally empty.*
