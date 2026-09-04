# Module 2: Tenant Administration (Company Admin)

**Covers:** PRD FR-2
**Depends on:** Module 1 (a company + company_admin user must exist)
**Build order:** 2nd — unlocks staff/products for later modules

## Users
Company Admin

## Screens
1. **Dashboard** — quick stats (optional V1: order count today), open/closed toggle for the canteen.
2. **Staff List / Create Staff** — form: name, username, password, email, role (`staff`).
3. **Category Management** — CRUD list for `categories`.
4. **Department Management** — CRUD list for `departments`.
5. **Product List (Admin view)** — CRUD, with sold-out toggle inline.
6. **Product Create/Edit** — name, description, image upload, price, is_veg.

## APIs

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/tenant/staff` | Create staff user |
| GET/PATCH | `/tenant/staff/:id` | View/update staff (status, role) |
| CRUD | `/tenant/categories` | Category management |
| CRUD | `/tenant/departments` | Department management |
| CRUD | `/tenant/products` | Product management |
| PATCH | `/tenant/products/:id/soldout` | Toggle sold-out |
| PATCH | `/tenant/companies/:id/open-status` | Open/close canteen for ordering |

## Business Rules
- All writes scoped to the caller's `company_id` (from auth claim, not request body).
- Product image upload → Firebase Storage → store `image_url` on the product document.
- Deleting a category/department in use should soft-delete only (`is_deleted = true`), never hard-delete referenced master data.

## Data Touchpoints (see 03-Data-Model.md)
- `users` (create staff)
- `categories`, `departments` (CRUD)
- `products` (CRUD, sold-out toggle)
- `companies` (`is_open` toggle)

## Acceptance Criteria
- **Given** a logged-in Company Admin, **when** they create a staff user, **then** the new `users` document has `role_id = staff` and `company_id` matching the admin's own company — never a different tenant's.
- **Given** a product with `is_soldout = true`, **when** a student views the product list, **then** the item is visibly marked sold out and cannot be added to cart (validated jointly with Module 5).
- **Given** an uploaded product image, **when** the product is saved, **then** the image is stored in Firebase Storage and only the resulting `image_url` is persisted on the product document (not raw binary).
