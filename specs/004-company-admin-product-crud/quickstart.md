# Quickstart: Validating Company Admin Product Management

**Feature**: `004-company-admin-product-crud`

Manual/scriptable validation guide against `contracts/openapi.yaml` and `data-model.md`. Requires `001`'s migrations applied and at least one Company + Company Admin (and one Staff account, for Scenario 3) already set up.

## Prerequisites

- A running API instance with the `products` table and its RLS policies applied.
- Two Companies (A and B), each with their own Company Admin, for the cross-tenant check.
- One Staff account belonging to Company A, for the shared sold-out-toggle check.

## Scenario 1 — Create a product (User Story 1)

1. As Company A's Company Admin, `POST /tenant/products` with `{name, description, price: 4000, is_veg: true}`.
   - **Expect**: `201`, `is_soldout: false`, `image_url: null`.
2. `POST /tenant/products` again, omitting `name`.
   - **Expect**: `400`.
3. `POST /tenant/products` with `price: 0`.
   - **Expect**: `400`.
4. `POST /tenant/products/{id}/image` with an image file, using the product from step 1.
   - **Expect**: `200`, `image_url` now populated with a retrievable URL.
5. As Company B's Company Admin, `GET /tenant/products`.
   - **Expect**: the product from step 1 never appears — confirms tenant isolation (FR-003, SC-004).

## Scenario 2 — Sold-out toggle is independent of other fields (User Story 2)

1. `PATCH /tenant/products/{id}/soldout` with `{"is_soldout": true}` on the product from Scenario 1.
   - **Expect**: `200`, `is_soldout: true`; `name`/`description`/`price`/`is_veg`/`image_url` all unchanged from Scenario 1.
2. `GET /tenant/products` as the same Company Admin.
   - **Expect**: the product is present and clearly flagged `is_soldout: true`.
3. `PATCH /tenant/products/{id}/soldout` with `{"is_soldout": false}`.
   - **Expect**: `200`, back to available, still no other field changed.

## Scenario 3 — Staff can toggle sold-out but not edit (FR-012)

1. As Company A's Staff account, `PATCH /tenant/products/{id}/soldout` with `{"is_soldout": true}`.
   - **Expect**: `200` — Staff is authorized for this one operation.
2. As the same Staff account, `PATCH /tenant/products/{id}` with `{"price": 5000}`.
   - **Expect**: `403` — full edit remains Company-Admin-only.

## Scenario 4 — Edit updates only submitted fields (User Story 3)

1. `PATCH /tenant/products/{id}` with only `{"price": 4500}`.
   - **Expect**: `200`, `price: 4500`; `name`, `description`, `is_veg`, `image_url`, `is_soldout` all retain their prior values.
2. `PATCH /tenant/products/{id}` with `{"price": 0}`.
   - **Expect**: `400`; a follow-up `GET` confirms the price from step 1 is unchanged (rejected update made no partial change).

## Scenario 5 — Remove a product (User Story 4)

1. `DELETE /tenant/products/{id}`.
   - **Expect**: `204`.
2. `GET /tenant/products` as the same Company Admin.
   - **Expect**: the removed product no longer appears.
3. `PATCH /tenant/products/{id}` (any field) on the removed product.
   - **Expect**: `404` — cannot be edited via the normal flow once removed (FR-009).
4. `PATCH /tenant/products/{id}/soldout` on the removed product.
   - **Expect**: `404` — same restriction applies to the toggle.

## Pass/Fail

Any deviation — especially Company B ever seeing Company A's product (Scenario 1 step 5), Staff succeeding at a full edit (Scenario 3 step 2), or a removed product remaining editable (Scenario 5) — is a blocking failure per SC-002/SC-004 and must not ship.
