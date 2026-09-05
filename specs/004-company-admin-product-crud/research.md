# Phase 0 Research: Company Admin Product Management

**Feature**: `004-company-admin-product-crud` | **Date**: 2026-09-05

Depends on `001-company-role-user-setup` for the `companies`/`users`/`roles` schema, NestJS/Supabase-Postgres baseline, and RLS pattern (research.md §1–§2 there), which this feature reuses. This document resolves the implementation-pattern unknowns specific to Products.

## 1. Image storage

- **Decision**: Store the uploaded product photo in Supabase Storage (Architecture §1: "File storage: Supabase Storage (product images)") and persist only the resulting `image_url` on the `products` row — never the binary itself in Postgres.
- **Rationale**: This is Architecture's own explicit decision, and matches the corrected design already noted against the legacy (pre-Supabase) data-model draft: a document/row store isn't meant to hold binary blobs; a URL pointing at object storage is the standard pattern and is what the rest of this codebase's file-handling (none yet, but this is the only file-upload case in scope so far) should establish as precedent.
- **Alternatives considered**: Storing the image as a database blob — rejected outright, both by Architecture's own decision and by the spec's Assumption that photo upload should stay low-friction (a blob column doesn't change friction, but it does complicate every future concern — backups, CDN delivery, resizing — that a storage-bucket URL sidesteps for free).

## 2. Row Level Security for `products`

- **Decision**: Apply the exact same RLS shape `001` established for `categories`/`departments` (research.md §2 there) — `company_id`-scoped `USING`/`WITH CHECK` policies — but **without** a `system_admin` bypass predicate, since FR-003 (as corrected during planning) explicitly does not grant System Admin any cross-tenant Product access.
- **Rationale**: Reusing the proven pattern keeps tenant isolation consistent platform-wide; omitting the bypass is a direct, literal implementation of what this spec's corrected FR-003 says — adding one anyway would silently reintroduce the over-reach that got caught and fixed in the spec itself.
- **Alternatives considered**: Copying `001`'s Category/Department policy verbatim (including the `system_admin` bypass) — rejected because it would grant an access level this spec explicitly does not authorize; if a future business need arises for platform-wide Product oversight, that should be its own spec decision, not an accidental carry-over from copy-pasting a policy.

## 3. Sold-out toggle as a distinct write path from full edit

- **Decision**: Expose sold-out toggling as its own endpoint/operation (`PATCH .../soldout`), separate from the general product-update endpoint, even though both ultimately `UPDATE` the same row.
- **Rationale**: FR-006 requires the toggle to work "independently of, and without requiring, any change to its other fields," and FR-012 shares this specific capability with the Staff role while reserving full edit for Company Admin only. A single combined update endpoint would force an authorization check to special-case "did this request only touch `is_soldout`," which is more fragile than simply authorizing two distinct operations differently from the start — this mirrors how `001`'s own Company/Category/Department distinguished "toggle open/closed" from general update.
- **Alternatives considered**: One generic `PATCH` endpoint accepting a partial body, authorized by inspecting which fields changed — rejected as needlessly fragile (a client sending `{is_soldout: false}` where `false` happens to equal the current value would be indistinguishable from "no change requested," complicating the authorization check for no real benefit).

## 4. Soft-delete and referential integrity for `products`

- **Decision**: `products.is_deleted boolean not null default false`, exactly mirroring `categories`/`departments` in `001`. A removed product is excluded from every "active list" query via `WHERE is_deleted = false`, but its row (and `id`) remain permanently valid as a foreign-key target for anything that already reference it (Order line items, out of this feature's scope to create).
- **Rationale**: Directly implements FR-008/FR-009 and keeps the soft-delete convention consistent across every entity in the platform so far (`001`'s Categories/Departments/Users), rather than inventing a second pattern for Products.
- **Alternatives considered**: A `status` enum (e.g., `active`/`discontinued`) instead of a boolean — workable, but there is no evidence in the spec of more than two states for a Product (unlike `users.status`, which genuinely has three: `active`/`inactive`/`locked`), so the simpler boolean matches the actual requirement without inventing unused states.

## 5. Uniqueness (or lack thereof) on product name

- **Decision**: No uniqueness constraint on `products.name` within a `company_id` — no unique index is added.
- **Rationale**: Directly implements the spec's own Assumption ("Product names are not required to be unique"). Unlike `categories`/`departments` in `001` (which do enforce case-insensitive per-company uniqueness), there is no equivalent requirement here, and adding one unrequested would block a legitimate real-world case the spec explicitly calls out (a seasonal variant sharing a name).
- **Alternatives considered**: Enforcing uniqueness "for data quality" — rejected as scope creep beyond what FR-004 (validation) actually requires; the spec was deliberate about this.

## Outstanding NEEDS CLARIFICATION

None. The spec shipped with zero clarification markers. One drafting inconsistency (an unfounded System-Admin cross-tenant claim in FR-003) was caught and corrected in the spec itself before this research began (see FR-003's current wording and research.md §2 above).
