# Business Requirements Document (BRD)
## GenzFeast — Multi-Tenant College Canteen Food Ordering Platform

| | |
|---|---|
| **Document** | BRD |
| **Product** | GenzFeast |
| **Version** | 1.0 (V1 Release Scope) |
| **Status** | Draft — for stakeholder review |

---

## 1. Purpose

GenzFeast is a multi-tenant (multi-company) mobile food ordering platform that connects college canteens ("companies"/tenants) with students on their campus. Each canteen operates as an independent tenant with its own staff, products, and orders, while a central System Admin governs onboarding and platform-wide oversight.

This document defines the business need, objectives, stakeholders, scope, and success criteria that all subsequent artifacts (PRD, Data Model, Architecture, Module docs, UI Design) must satisfy.

## 2. Business Problem

College canteens currently rely on manual, in-person, first-come-first-served ordering. This causes:
- Long physical queues during peak hours (breaks, lunch).
- No visibility into order status or wait time for students.
- No digital record of sales, demand, or inventory (sold-out items) for canteen staff.
- No standardized way to onboard a new canteen and start operating quickly.

## 3. Business Objectives

| # | Objective | Success Metric |
|---|---|---|
| O1 | Reduce physical queue/wait time at canteens | Avg. pickup wait time reduced vs. baseline |
| O2 | Give each canteen an independent, self-serve digital storefront | New tenant onboarded and live in < 1 day |
| O3 | Digitize payment collection and order tracking | 100% of V1 orders paid online, OTP-verified pickup |
| O4 | Provide staff a simple tool to manage stock (sold-out) and fulfilment | Staff can mark sold-out / close an order in ≤ 2 taps after login |
| O5 | Enable the platform owner to operate many canteens (multi-tenant) from one system | Onboard N tenants without code changes per tenant |

## 4. Stakeholders

| Stakeholder | Interest |
|---|---|
| **System Admin (Platform Owner)** | Onboards canteens (tenants), oversees the whole platform |
| **Company/Tenant Admin** | Manages their canteen's staff, products, and pricing |
| **Staff** | Fulfils orders: marks items sold out, verifies OTP, hands over food |
| **Student (End User)** | Browses menu, orders, pays, picks up food using OTP |
| **Engineering (Claude Code / dev team)** | Builds the system from these specs |

## 5. Scope — V1 (In Scope)

- Multi-tenant company (canteen) management by System Admin.
- Tenant Admin: staff/user management, product CRUD, sold-out toggle.
- Staff: sold-out toggle, order fulfilment via OTP.
- Student: registration/login, browse menu, cart, **canteen pickup only** (no delivery-address flow in V1), online payment, 6-digit numeric OTP for pickup verification.
- Forgot-password flow via alphanumeric OTP push notification (Firebase Cloud Messaging).
- Order lifecycle: `payment_pending → order_placed → delivered`, with a `payment_failed` retry path.

## 6. Out of Scope (V1)

- Home/hostel delivery (address-based delivery) — pickup only.
- Multiple payment gateways (one default gateway integration only, auto-selected).
- Loyalty/rewards, ratings & reviews, order history analytics/dashboards.
- Web portal for students (mobile-only).
- Real-time order-tracking map/live rider tracking (not applicable — pickup only).
- In-app chat/support.
- Refund automation (manual/ops-handled in V1).

> These are candidates for V2 and should be re-confirmed with the business owner before Architecture is finalized, since some (e.g., delivery) affect the data model and order state machine.

## 7. Assumptions

1. "Firebase database" refers to **Cloud Firestore** (NoSQL document store), not the legacy Realtime Database. *(To be confirmed — see Architecture doc §2.)*
2. "Separate mobile application per company/tenant" means each tenant gets its own **branded build** (app icon/name/theme) generated from a **single shared codebase** via tenant configuration — not a separately maintained codebase per tenant. *(To be confirmed — see Architecture doc §3.)*
3. One student account belongs to exactly one company/tenant (a student registers within a specific canteen's app).
4. One payment gateway is used in V1 (e.g., Razorpay/Stripe — to be finalized by business).
5. "Category" = food category (e.g., Snacks, Beverages); "Department" = student's academic department — both are tenant-scoped master tables.
6. Order OTP and password-reset OTP are two distinct fields/flows, both delivered via Firebase Cloud Messaging (push), not SMS.

## 8. Business Rules (High Level)

1. A student can only browse and order from the single tenant app they registered on.
2. A product marked **sold out** cannot be added to a new cart, but existing carts/orders referencing it remain valid.
3. An order can only move to `order_placed` after the payment gateway confirms success.
4. A pickup OTP is generated only once, at the moment payment succeeds, and is single-use (invalidated once the order is `delivered`).
5. A failed payment keeps the order in `payment_failed` and offers a "Pay Again" action; it does not create a duplicate order.
6. `no_of_login_attempt` increments on every failed login and on every forgot-password request; it resets to 0 only after a successful password reset.

## 9. Risks & Constraints

| Risk | Mitigation |
|---|---|
| Firestore is NoSQL — relational-style joins (company → users → orders) need denormalization | Data Model doc defines tenant-scoped collections and duplication strategy |
| Per-tenant app builds increase release/maintenance overhead | Use build flavors/config-driven theming instead of code forks |
| OTP delivery via push notification requires the app to be installed & notification permission granted | Add an in-app fallback screen showing the OTP (already required per PRD) |
| Payment gateway webhook reliability | Architecture must support both redirect-callback and server-to-server webhook verification |

## 10. Approval

| Role | Name | Status |
|---|---|---|
| Business Owner | _TBD_ | Pending |
| Product Owner | _TBD_ | Pending |
| Tech Lead | _TBD_ | Pending
