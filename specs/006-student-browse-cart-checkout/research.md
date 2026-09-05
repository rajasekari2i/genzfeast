# Phase 0 Research: Browse, Cart & Checkout with Payment

**Feature**: `006-student-browse-cart-checkout` | **Date**: 2026-09-05

Depends on `001-company-role-user-setup` (`companies`/`users`/RLS baseline), `004-company-admin-product-crud` (`products`, read-only here), and fulfills the `orders` dependency contract `005-staff-order-fulfilment-otp` already declared. This document resolves the implementation-pattern unknowns specific to browsing, cart, and payment.

## 1. Cart is client-side only — no `carts` table

- **Decision**: The cart lives entirely in the mobile client's local state (in-memory / local storage), keyed by product id and quantity. The backend has no cart-related table or endpoint until the moment of `POST /student/orders` (place order), which accepts the client's current selection and immediately either creates an order or rejects it.
- **Rationale**: Directly implements the spec's own Assumption — no cart entity appears in any source document, and FR-009 already establishes that only the resulting *Order* is a durable, snapshotted record. Avoiding a server-side cart table also sidesteps a whole class of sync problems (multi-device cart merge, cart TTL/expiry) that nothing in the spec asks for.
- **Alternatives considered**: A persisted `cart_items` table (one row per student per product) — rejected as unrequested scope; it would need its own lifecycle/expiry rules the spec never calls for, purely to support a "resume my cart on another device" capability that was never a requirement.

## 2. Never trust client-supplied price/name at order placement

- **Decision**: `POST /student/orders` accepts only `{product_id, quantity}` pairs from the client. The backend looks up each `product_id`'s *current* `name`, `price`, and `is_soldout`/`is_deleted` status server-side, rejects the whole request if any item is unavailable (FR-008), and only then builds the immutable snapshot (FR-009, FR-020) from that server-side data — the client's own displayed price is informational only, never authoritative.
- **Rationale**: This is the same trust boundary already established platform-wide (`001`/`002`: role and company_id are always derived from the verified JWT, never the request body) applied to money. A client that could dictate its own price at checkout would be a direct payment-integrity hole.
- **Alternatives considered**: Trusting a client-echoed price and only spot-checking it — rejected outright; there's no scenario where accepting a client-asserted price is acceptable for a paid transaction.

## 3. At most one unresolved order per student — enforcement mechanism

- **Decision**: A partial unique index, `UNIQUE (user_id) WHERE status IN ('payment_pending', 'payment_failed')`, directly enforces FR-016 at the database layer. `POST /student/orders` first checks for an existing row matching that condition and, if found, returns it (redirecting the student back to it, per FR-016) instead of attempting an insert that the index would reject anyway.
- **Rationale**: A database constraint is cheaper and more reliable to reason about than "the API remembered to check first" — mirrors the same defense-in-depth philosophy `001`'s RLS-plus-API-scoping approach already established (belt-and-suspenders, not either/or). Scoping the constraint to exactly `payment_pending`/`payment_failed` (not `order_placed`) matches FR-016's precise wording — a student may still have multiple `order_placed` orders awaiting pickup at once; only the *unresolved-payment* state is capped at one.
- **Alternatives considered**: Enforcing the one-active-order rule purely in application code — rejected as the sole mechanism, for the same reason `001` never relies on API-layer checks alone for an invariant that matters.

## 4. Payment gateway integration shape

- **Decision**: On order creation, the backend opens a Razorpay order (UPI-only checkout) and stores its reference in `orders.payment_gateway_ref`; the client is handed just enough to launch Razorpay's checkout/UPI-intent flow. The *only* thing that finalizes `payment_pending → order_placed`/`payment_failed` is a Razorpay webhook call to a dedicated endpoint, verified via Razorpay's HMAC-SHA256 webhook-signature scheme against a server-held secret — never the client's own post-payment redirect (FR-011, Architecture §7's "critical design rule").
- **Rationale**: This is Architecture §7's explicit, already-decided sequence; this feature's job is to implement it faithfully, not redesign it.
- **Alternatives considered**: Also accepting a client-reported "payment succeeded" redirect as sufficient to finalize the order — rejected outright per FR-011 and Architecture's explicit rule against exactly this.

## 5. Webhook idempotency

- **Decision**: The webhook handler is idempotent by design: it looks up the order by `payment_gateway_ref`, and only applies a transition if the order's current `status` is still `payment_pending`. A duplicate/replayed webhook for an order already in `order_placed` or `payment_failed` is acknowledged (200 OK, so Razorpay stops retrying) but produces no further state change, no second OTP generation, and no duplicate audit-log entry beyond what the first delivery already wrote.
- **Rationale**: Webhook delivery is inherently at-least-once (network retries, provider-side redelivery on a slow response) — without this guard, a redelivered "success" webhook could regenerate a *second* pickup code for an already-placed order, silently invalidating the one the student already saw, or a redelivered "failure" webhook could flip an already-succeeded order back to failed.
- **Alternatives considered**: Deduplicating via a separately tracked "webhook event id" table — workable, but the status-guard above already achieves the same safety property using data the order row already has, without a second table.

## 6. Row Level Security for `orders` — two different audiences, one table

- **Decision**: `orders` gets role-conditional policies rather than a single blanket predicate:
  - `SELECT`/`INSERT` for `student`: only rows where `user_id = current_user_id AND company_id = current_company_id`.
  - `SELECT` for `staff`/`company_admin`: any row where `company_id = current_company_id` (the API layer further restricts `staff`'s *list* view to `status = 'order_placed'`, per `005`).
  - `UPDATE`: restricted to the backend's own trusted service context for the payment-webhook transition, plus the `staff` role for exactly the `order_placed → delivered` transition `005` already specified — no role can update any other field.
  - No `system_admin` bypass — nothing in this spec (or any other) grants System Admin visibility into individual orders, consistent with the "no unauthorized cross-tenant reach" discipline established in `004`/`005`.
- **Rationale**: Unlike `categories`/`departments`/`products` (shared master data, visible to everyone in the company), an Order is a personal record — a student must not see another student's order, while Staff legitimately need to see every order in their company to fulfil it (`005`'s own requirement). One company-wide policy would either over-expose orders to other students or under-expose them to Staff; two role-conditional policies satisfy both.
- **Alternatives considered**: Enforcing the student-vs-staff visibility split purely at the API-query layer with a single permissive RLS policy — rejected for the same defense-in-depth reason as `001`: a query-builder bug that forgot the `user_id` filter would leak every student's orders to every other student, with RLS as the only backstop.

## 7. Confirms `005`'s dependency contract is satisfied

- **Decision**: The `orders` schema in data-model.md includes every column `005-staff-order-fulfilment-otp` declared as a dependency (`id`, `company_id`, `status` including `order_placed`/`delivered`, `items`, `total_amount`, `otp` stored in a re-readable form, `created_at`, `delivered_at`), plus this feature's own additions (`user_id`, `fulfilment_type`, `payment_status`, `payment_gateway_ref`, `updated_at`).
- **Rationale**: Closing the loop on the consumer-driven contract `005` documented — this is the "future Checkout & Payment feature" that contract was written for.
- **Alternatives considered**: N/A — this is a verification step, not a design choice.

## Outstanding NEEDS CLARIFICATION

None. The spec's one clarification (order-cancellation scope) was already resolved during `/speckit-specify` (FR-021: no cancellation in V1).
