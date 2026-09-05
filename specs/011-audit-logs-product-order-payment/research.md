# Phase 0 Research: Audit Trail for Product, Order & Payment Changes

**Feature**: `011-audit-logs-product-order-payment` | **Date**: 2026-09-05

Depends on `004-company-admin-product-crud` (`products`), `006-student-browse-cart-checkout` (`orders`), and `010-resume-pending-order-payment` (`payment_attempts`). This document works out the generic trigger mechanism Architecture §7/§10 and BRD Assumption 8 have referenced since `001` but never designed.

## 1. One generic trigger function, attached to three tables

- **Decision**: A single PL/pgSQL trigger function, `fn_audit_log()`, fired `AFTER INSERT OR UPDATE` on `products`, `orders`, and `payment_attempts`. It is table-agnostic: it reads `TG_TABLE_NAME`/`TG_OP` and the `NEW`/`OLD` rows generically (via `row_to_json`), rather than three separate hand-written trigger functions.
- **Rationale**: A single function is easier to reason about and test once, and guarantees the three tables behave identically (same column-exclusion rules, same actor-resolution logic) rather than risking three copies drifting apart over time. Reusing it later for `001`'s entities (out of this feature's scope, per its own Assumption) becomes a one-line `CREATE TRIGGER` addition instead of new code.
- **Alternatives considered**: A separate, hand-written trigger per table — rejected as needless duplication for logic that is genuinely identical across all three tables today.

## 2. Distinguishing "created" / "updated" / "removed"

- **Decision**: `TG_OP = 'INSERT'` → `action = 'created'`. `TG_OP = 'UPDATE'` → `action = 'updated'`, **except** when the row has an `is_deleted` column and it transitions from `false`/`NULL` to `true`, in which case `action = 'removed'` (this only ever applies to `products`, per `004`'s soft-delete design — `orders` and `payment_attempts` have no `is_deleted` column and are never soft-deleted).
- **Rationale**: Directly implements FR-001/FR-004's three named action kinds using data the trigger already has (`OLD`/`NEW`), without needing a separate signal from the application layer about *why* an update happened.
- **Alternatives considered**: Requiring the application to explicitly pass an "action type" — rejected; it would reintroduce exactly the "application code must remember to do this correctly" risk the generic-trigger approach exists to eliminate.

## 3. Computing "previous and new value of any changed field" — and excluding bookkeeping columns

- **Decision**: For an `UPDATE`, the trigger diffs `OLD` against `NEW` column-by-column (via `row_to_json` on each and comparing keys), excluding a fixed list of structural bookkeeping columns that trivially change on every write and carry no business meaning of their own: `created_at`, `updated_at`, `created_by`, `updated_by`. Only columns outside that exclusion list whose value actually differs are recorded, each as `{"old": ..., "new": ...}` in a single `jsonb` `changed_fields` field on the audit record.
- **Rationale**: Directly implements FR-004's "previous and new value of any changed field" and the spec's own Assumption that only meaningful business fields are tracked this way — `updated_at` changing on literally every single update would otherwise appear in every diff, adding noise without information.
- **Alternatives considered**: Storing the full `OLD`/`NEW` row snapshots instead of a computed diff — rejected as noisier to read back later (an investigator would have to manually diff two full JSON blobs themselves) for no benefit, since Postgres can cheaply compute the diff once at write time.

## 4. Identifying the acting user or automated process (never blank)

- **Decision**: Every DB write path — whether a normal authenticated API request or an automated process like the payment webhook — must set exactly one of two Postgres session variables before writing: `app.current_user_id` (for a real, logged-in actor; already set on every authenticated request per `001`'s established `SET LOCAL` pattern) or `app.current_system_actor` (a short, fixed name like `'payment_webhook'`, set by automated code paths that have no authenticated user, such as `006`'s webhook handler). The trigger reads whichever is set: if `app.current_user_id` is present, it populates `performed_by_user_id`; otherwise it populates `performed_by_system` from `app.current_system_actor`.
- **Rationale**: Directly implements FR-005 — an automated process's writes (the single largest source of Order/payment-attempt mutations, since the webhook drives most status transitions) must never produce a blank or misleading "no one" in the audit trail. Reusing the session-variable mechanism `001` already established for `company_id`/`role` scoping means no new plumbing concept is introduced, only one more variable in the same family.
- **Alternatives considered**: Inferring the actor from `updated_by` on the row itself — rejected; `006`'s webhook handler doesn't necessarily set `orders.updated_by` to any particular value today, and conflating "who the row says last touched it" with "who is credited for *this specific* audit entry" would break down the moment two different writers touch a row in quick succession (exactly the concern `010`'s `payment_attempts` design already had to solve for a related reason).

## 5. Making audit records immutable at the database layer, not just "we don't expose an endpoint"

- **Decision**: The application's database role has its `UPDATE` and `DELETE` privileges on `audit_logs` explicitly revoked; only `INSERT` (performed by the trigger, which runs with the privileges needed to write) is possible through the connection the API uses day to day.
- **Rationale**: Directly implements FR-006 as a real database-level guarantee, not merely the absence of an API endpoint — consistent with the platform's established defense-in-depth philosophy (e.g., `001`'s two-layer API+RLS tenant isolation): a bug or a future feature that *tries* to update an audit row should fail loudly at the database, not silently succeed because nothing happened to prevent it at that layer.
- **Alternatives considered**: Relying solely on "no UI/endpoint exists to edit them" — rejected as insufficient per the platform's own established standard for security-critical guarantees; the same reasoning that put RLS underneath the API's own scoping applies here.

## 6. `audit_logs` schema and access

- **Decision**: `audit_logs` carries a denormalized `company_id` (looked up from `NEW.company_id` directly for `products`/`orders`, or via a join to `orders` for `payment_attempts`, which has no `company_id` column of its own per `010`), even though this feature builds no viewing capability that would query by it yet (spec Assumption) — so a future viewing feature doesn't need a schema change, only a query. Row Level Security is enabled with no policy granting any application role `SELECT` access at all for now, matching the spec's explicit "capture only, no viewing screen in this feature" scope; only a direct database-admin connection (outside the app's own role) can currently read it.
- **Rationale**: Cheap to add now, avoids a future migration purely to add a column that's already trivially derivable at write time; the deny-by-default RLS posture means adding a viewing feature later is additive (grant a new policy) rather than needing to retrofit tenant scoping onto data that was previously unscoped.
- **Alternatives considered**: Omitting `company_id` until a viewing feature actually needs it — rejected as a purely cosmetic saving that creates avoidable rework later for a column with an obvious, cheap-to-compute value today.

## Outstanding NEEDS CLARIFICATION

None. The spec shipped with zero clarification markers.
