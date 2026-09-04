# Data Model
## GenzFeast — Cloud Firestore Collection Design

> Assumption: Cloud Firestore (NoSQL document DB) is used, as per Architecture doc §2. Field names are normalized/typo-corrected from the source PRD. Types use JS/TS notation for direct use in the Node.js backend and React Native client.

## 0. Common Fields (present on every document unless noted)

| Field | Type | Notes |
|---|---|---|
| `id` | string | Firestore document ID |
| `created_at` | timestamp | Server timestamp on create |
| `updated_at` | timestamp | Server timestamp on every update |
| `created_by` | string (user id) | Who created the record |
| `updated_by` | string (user id) | Who last updated the record |
| `is_deleted` | boolean | Soft delete flag (default `false`) |

## 1. Collection: `companies` (Tenant)

| Field | Type | Notes |
|---|---|---|
| `name` | string | Canteen/company name |
| `contact_person` | string | |
| `mobile` | string | E.164 or local format, validated |
| `email` | string | |
| `address` | string | |
| `is_open` | boolean | Toggles whether the canteen currently accepts orders |
| `app_config` | map | `{ theme_color, logo_url, app_display_name }` — supports the "separate app per tenant" branding requirement (see Architecture) |

**Top-level collection.** All tenant-scoped collections below store a `company_id` reference back to this document.

## 2. Collection: `users`

| Field | Type | Notes |
|---|---|---|
| `name` | string | |
| `username` | string | Mobile number; unique **within** `company_id` |
| `password_hash` | string | Renamed from `password` — **never store plain text**; bcrypt/argon2 hash |
| `role_id` | string (ref → `roles`) | |
| `category_id` | string (ref → `categories`) | |
| `department_id` | string (ref → `departments`, nullable) | Optional per PRD open question |
| `email` | string | |
| `company_id` | string (ref → `companies`) | Tenant scope |
| `no_of_login_attempt` | number | Default 0 |
| `reset_password_otp` | string, nullable | 6-char alphanumeric, cleared after use |
| `reset_password_otp_expires_at` | timestamp, nullable | *(added — OTPs must expire; not in source PRD but required for security)* |
| `status` | string enum | `active` \| `inactive` \| `locked` |

> Note: `username` uniqueness should be enforced per tenant (a mobile number could theoretically register at two different canteens as two separate accounts, per Assumption §7.3 in BRD).

## 3. Collection: `roles`

| Field | Type | Notes |
|---|---|---|
| `name` | string | e.g., `system_admin`, `company_admin`, `staff`, `student` |
| `company_id` | string, nullable | `null` for the global `system_admin` role; set for tenant-scoped roles |

## 4. Collection: `departments`

| Field | Type | Notes |
|---|---|---|
| `name` | string | e.g., "Computer Science" |
| `company_id` | string (ref → `companies`) | |

## 5. Collection: `categories`

| Field | Type | Notes |
|---|---|---|
| `name` | string | e.g., "Snacks", "Beverages" — used both for student profile category and could double as product category (confirm with business whether these are the same table or two distinct ones; source PRD implies one shared `category` table referenced by both `User.category_id` and conceptually by products) |
| `company_id` | string (ref → `companies`) | |

## 6. Collection: `products`

| Field | Type | Notes |
|---|---|---|
| `name` | string | |
| `description` | string | |
| `image_url` | string | Stored in **Firebase Storage**, not as a DB blob (see note below) |
| `price` | number | Store as integer paise/cents to avoid float rounding errors |
| `is_veg` | boolean | |
| `is_soldout` | boolean | Default `false` |
| `company_id` | string (ref → `companies`) | |

> **Correction from source PRD:** the original model listed both `image (blob storage)` and `picture (blob)`. Firestore documents have a 1MB size limit and are not designed for binary blobs. The corrected design stores the **image in Firebase Storage** and keeps only the resulting `image_url` string on the product document. The duplicate `picture` field is removed as redundant.

## 7. Collection: `orders`

| Field | Type | Notes |
|---|---|---|
| `user_id` | string (ref → `users`) | *(added — the source model omitted the ordering student's id, which is required to query "my orders")* |
| `items` | array<map> | `[{ product_id, name, price, quantity, line_total }]` — name/price snapshotted at order time |
| `total_amount` | number | |
| `fulfilment_type` | string enum | `pickup` (fixed value in V1) |
| `status` | string enum | `payment_pending` \| `order_placed` \| `payment_failed` \| `delivered` \| `cancelled` |
| `payment_status` | string enum | `pending` \| `success` \| `failed` |
| `payment_gateway_ref` | string, nullable | *(added — needed to reconcile gateway callbacks/webhooks)* |
| `otp` | string, nullable | 6-digit numeric, generated on payment success, cleared/invalidated on delivery |
| `company_id` | string (ref → `companies`) | |

## 8. Collection: `deliveries`

| Field | Type | Notes |
|---|---|---|
| `order_id` | string (ref → `orders`) | |
| `otp` | string | Snapshot of the OTP verified (for audit) |
| `order_status` | string enum | `pending` \| `delivered` \| `failed_attempt` |
| `verified_by` | string (user id, staff) | *(added — for audit: which staff member closed the order)* |
| `company_id` | string (ref → `companies`) | |

## 9. Relationship Diagram

```
companies (1) ──< users (role: company_admin / staff / student)
companies (1) ──< departments
companies (1) ──< categories
companies (1) ──< products
companies (1) ──< orders ──(1)──< deliveries
users (student, 1) ──< orders
roles (1) ──< users
categories (1) ──< users (student's category)
departments (1) ──< users (student's department)
```

## 10. Indexing Notes (Firestore Composite Indexes)

| Query | Index needed |
|---|---|
| Products for a company, hide sold-out first | `company_id` + `is_soldout` + `is_deleted` |
| Orders for staff "incoming queue" | `company_id` + `status` + `created_at` |
| A student's own orders | `user_id` + `created_at` |
| Users within a company by role | `company_id` + `role_id` |

## 11. Firestore Security Rules — Key Principles

1. Every read/write on a tenant-scoped collection must verify `request.auth.token.company_id == resource.data.company_id`.
2. Only `system_admin` custom claim can write to `companies`.
3. Only `company_admin`/`staff` custom claims (scoped to their `company_id`) can write `products`, `categories`, `departments`.
4. `orders.otp` and `users.reset_password_otp` should be writable only by backend (Cloud Functions/Admin SDK) — never directly from the client — to prevent OTP tampering.
5. Students can only read/write their **own** `orders` (`resource.data.user_id == request.auth.uid`); staff can read all orders for their `company_id` and update `status`/`otp`-verification fields only via a Cloud Function.
