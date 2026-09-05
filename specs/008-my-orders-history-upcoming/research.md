# Phase 0 Research: My Orders — History & Upcoming Orders

**Feature**: `008-my-orders-history-upcoming` | **Date**: 2026-09-05

Depends entirely on `006-student-browse-cart-checkout`'s `orders` table and its existing RLS (student sees only their own rows). Like `007`, this feature requires **no new table, no migration, and no new RLS policy** — it is a query-shaping and response-shaping layer only.

## 1. One endpoint, filtered by a query parameter — not two separate routes

- **Decision**: Extend `006`'s existing `GET /student/orders` with an optional `view` query parameter (`upcoming` | `history`). `view=upcoming` filters to `status IN ('payment_pending', 'order_placed')`; `view=history` filters to `status IN ('delivered', 'payment_failed', 'cancelled')`. Omitting `view` keeps `006`'s original behavior (all of the caller's own orders, unfiltered) so nothing that already depends on that endpoint breaks.
- **Rationale**: This is the same list of rows, the same ownership rule, and the same RLS policy `006` already established — only the `WHERE status IN (...)` clause and the requested grouping differ. Two separate routes would duplicate the entire query/authorization path for a difference that's really just one filter predicate.
- **Alternatives considered**: Two new endpoints, `GET /student/orders/upcoming` and `GET /student/orders/history` — workable, and arguably more RESTfully explicit, but introduces two routes that are otherwise byte-for-byte identical to the existing one; a query parameter keeps a single source of truth for "how a student's own orders are fetched."

## 2. Sorting

- **Decision**: Both filtered views sort by `created_at DESC` (most recently placed first) — no new column or index beyond what a standard `ORDER BY created_at DESC` on an already-`user_id`-filtered, already-small-per-user row set requires.
- **Rationale**: Directly implements the spec's own Assumption (a single, consistent recency-based rule for both views, since the source UI Design document's "most relevant"/"most recent" phrasing doesn't define anything more specific).
- **Alternatives considered**: A custom "relevance" ordering for Upcoming (e.g., `order_placed` before `payment_pending`, since a ready-for-pickup order might be considered more urgent) — rejected as unrequested complexity; nothing in the spec asks for it, and simple recency is sufficient to satisfy every acceptance scenario.

## 3. Completing the Order Detail response

- **Decision**: `006`'s `OrderDetail` schema gains one additional field, `delivered_at` (nullable timestamp), populated only once `status = 'delivered'` (already set by `005-staff-order-fulfilment-otp`'s fulfilment flow, which writes `orders.delivered_at`). No new field is needed to signal "show Pay Again" — the client derives that entirely from `status === 'payment_failed'`, exactly the same way it already derives "show pickup code" from `status === 'order_placed'` in `006`.
- **Rationale**: `delivered_at` already exists as a column (per `005`'s data-model.md, which declared it as part of the `orders` dependency contract, and `006`, which fully owns the column) — this feature only needs to start including it in the API response, not create anything new. Avoiding a redundant "can retry" boolean keeps the response's status-derived logic consistent in one place (the `status` field) rather than split across multiple flags that could theoretically disagree.
- **Alternatives considered**: Adding an explicit `actions: string[]` field listing which actions apply (`"pay_again"`, etc.) — rejected as unnecessary indirection; a client checking `status` directly is no harder and avoids a second source of truth.

## 4. `cancelled` in the History filter

- **Decision**: The History filter's `IN` clause includes `'cancelled'` even though, per the spec's own Assumption, no order in this platform will ever actually have that status in V1. The filter clause is written for schema completeness (and to require zero changes later if a future feature does introduce cancellation) rather than omitted now and added later.
- **Rationale**: Costs nothing (an `IN` clause with an unreachable value has no runtime effect since no row will ever match it) and avoids a future feature needing to remember to come back and edit this query.
- **Alternatives considered**: Omitting `'cancelled'` from the filter now, matching current reality exactly — rejected; it's marginally more "accurate" today but creates a guaranteed, easy-to-forget follow-up edit the moment cancellation is ever introduced.

## Outstanding NEEDS CLARIFICATION

None. The spec shipped with zero clarification markers.
