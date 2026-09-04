# Module-Based Specification
## GenzFeast — Implementation Modules — Index

> Each module is self-contained enough to hand to a single Claude Code session/agent, referencing the shared Data Model (03) and Architecture (04) docs. Modules map to the FR IDs in the PRD (02).
>
> **Each module also exists as its own standalone file** in `modules/`, so it can be handed to a separate agent/session independently:
> - [Module 1 — Platform Admin](modules/Module-1-Platform-Admin.md)
> - [Module 2 — Tenant Administration](modules/Module-2-Tenant-Administration.md)
> - [Module 3 — Staff Fulfilment](modules/Module-3-Staff-Fulfilment.md)
> - [Module 4 — Student Auth](modules/Module-4-Student-Auth.md)
> - [Module 5 — Product Browsing & Cart](modules/Module-5-Browsing-and-Cart.md)
> - [Module 6 — Checkout, Payment & Order Lifecycle](modules/Module-6-Checkout-and-Payment.md)

---

## Module 1: Platform Admin (System Admin)

**Covers:** PRD FR-1

**Users:** System Admin

**Screens**
1. Company List — search/list all companies, `is_open` status toggle.
2. Create/Edit Company — form: name, contact_person, mobile, email, address.
3. Create Company Admin — form: name, username, password (temp), email; auto-assigns `company_admin` role scoped to the created company.

**APIs**
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/admin/companies` | Create company |
| GET | `/admin/companies` | List companies |
| PATCH | `/admin/companies/:id` | Update company / toggle `is_open` |
| POST | `/admin/companies/:id/admins` | Create the Company Admin user for a company |

**Business Rules**
- Only `system_admin` claim can access this module.
- Creating a company should also seed default `roles` (`company_admin`, `staff`, `student`) scoped to `company_id`.

---

## Module 2: Tenant Administration (Company Admin)

**Covers:** PRD FR-2

**Users:** Company Admin

**Screens**
1. Dashboard — quick stats (optional V1: order count today, open/closed toggle for the canteen).
2. Staff List / Create Staff — form: name, username, password, email, role (`staff`).
3. Category Management — CRUD list for `categories`.
4. Department Management — CRUD list for `departments`.
5. Product List (Admin view) — CRUD, with sold-out toggle inline.
6. Product Create/Edit — name, description, image upload, price, is_veg.

**APIs**
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/tenant/staff` | Create staff user |
| GET/PATCH | `/tenant/staff/:id` | View/update staff (status, role) |
| CRUD | `/tenant/categories` | Category management |
| CRUD | `/tenant/departments` | Department management |
| CRUD | `/tenant/products` | Product management |
| PATCH | `/tenant/products/:id/soldout` | Toggle sold-out |
| PATCH | `/tenant/companies/:id/open-status` | Open/close canteen for ordering |

**Business Rules**
- All writes scoped to the caller's `company_id` (from auth claim, not request body).
- Product image upload → Firebase Storage → store `image_url` on product doc.
- Deleting a category/department in use should soft-delete only (`is_deleted = true`), never hard-delete referenced master data.

---

## Module 3: Staff Fulfilment

**Covers:** PRD FR-3, FR-9

**Users:** Staff

**Screens**
1. Product Sold-Out Toggle — reuse of Product List filtered to a simple flip switch per item.
2. Incoming Orders Queue — list of orders with `status = order_placed` for the company.
3. Order Fulfilment / OTP Entry — select an order, enter OTP, submit.

**APIs**
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/staff/orders?status=order_placed` | Incoming order queue |
| POST | `/staff/orders/:id/verify-otp` | Verify OTP; on match → set `delivered`, write `deliveries` record |

**Business Rules**
- OTP verification must happen server-side (Cloud Function/API), never compare OTP purely on-device.
- On mismatch, return a generic error (do not reveal the correct OTP) and log the attempt for audit.
- On match, `deliveries.verified_by` = the authenticated staff user id.

---

## Module 4: Student Auth (Registration, Login, Forgot Password)

**Covers:** PRD FR-4, FR-5

**Users:** Student

**Screens**
1. Registration — Name*, Username* (mobile), Password*, Category* (dropdown), Department (dropdown), Email*.
2. Login — Username, Password, "Forgot password" link.
3. Forgot Password (request) — Username, "Click to Verify".
4. Forgot Password (verify) — OTP, New Password, Retype Password, Submit.

**APIs**
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/auth/register` | Create student user (role=student, company_id from app's tenant config) |
| POST | `/auth/login` | Validate credentials; return session/custom token; increments `no_of_login_attempt` on failure |
| POST | `/auth/forgot-password/request` | Generate alphanumeric OTP, store + expiry, send via FCM, increment `no_of_login_attempt` |
| POST | `/auth/forgot-password/verify` | Validate OTP + set new password + reset `no_of_login_attempt` to 0 |

**Business Rules**
- On registration success, redirect directly to Home (auto-login).
- `no_of_login_attempt` threshold and any lockout behavior — **pending business decision** (PRD Open Question #2); implement as a configurable constant, not hardcoded.
- Forgot-password OTP has an expiry window (recommend 10 minutes) — new field not in the original PRD but required for security.
- On OTP mismatch during reset, show a toast/error (per PRD) and do not alter the password or `no_of_login_attempt` count further.

---

## Module 5: Product Browsing & Cart (Student)

**Covers:** PRD FR-6, FR-7

**Users:** Student

**Screens**
1. Home / Product List — grid or list of products (image, name, description, price, ADD + control), sticky bottom "N items · Continue ›" bar.
2. Cart — line items with qty +/-, per-line total, grand total, payment method selector, Place Order button.

**APIs**
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/products?company_id=...` | List active (non-deleted) products, sold-out flagged |
| (client-local state) | — | Cart is held client-side until checkout; no backend cart persistence needed for V1 |

**Business Rules**
- Sold-out products are visible but the ADD control is disabled.
- Cart quantity changes are purely client-side until "Place Order" is tapped (per PRD flow) — no draft-order writes to Firestore.
- Payment method list is currently a single default option (V1 constraint — one gateway); UI should still render the selector to support future gateways without redesign.

---

## Module 6: Checkout, Payment & Order Lifecycle

**Covers:** PRD FR-8

**Users:** Student (client), Backend (server-authoritative)

**Screens**
1. Payment redirect / in-app browser to the gateway.
2. Order Success screen — "Order Placed", shows OTP, order summary.
3. Order Failed screen — "Payment Failed", "Pay Again" button.

**APIs**
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/orders` | Create order (`payment_pending`), returns payment session/redirect URL |
| POST | `/orders/:id/retry-payment` | Re-initiate payment on an existing `payment_failed` order |
| POST | `/webhooks/payment` | Server-to-server gateway callback; authoritative status update |
| GET | `/orders/:id` | Poll/fetch current order status + OTP for the success screen |

**Business Rules**
- Order status transitions are **only** written by the backend after webhook verification (see Architecture §6) — the client never sets `status`/`payment_status` directly.
- OTP (`orders.otp`) generated exactly once, at the `payment_pending → order_placed` transition.
- `retry-payment` must reuse the same order id and items snapshot; it must not create a duplicate order or duplicate OTP.

---

## Module Dependency Order (Recommended Build Sequence)

```
1. Data Model + Architecture (shared foundation)
2. Module 1 (Platform Admin)        → unlocks tenant creation
3. Module 2 (Tenant Administration) → unlocks products/staff
4. Module 4 (Student Auth)          → unlocks student accounts
5. Module 5 (Browsing & Cart)       → depends on Module 2 products
6. Module 6 (Checkout & Payment)    → depends on Module 5
7. Module 3 (Staff Fulfilment)      → depends on Module 6 (orders must exist)
```
