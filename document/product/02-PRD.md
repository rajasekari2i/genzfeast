# Product Requirements Document (PRD)
## GenzFeast — V1

| | |
|---|---|
| **Product** | GenzFeast |
| **Platforms** | React Native (Android + iOS), Node.js backend, Firebase (Firestore, Auth/Storage, FCM) |
| **Version** | 1.0 |
| **Source** | Derived and clarified from stakeholder's original PRD draft |

---

## 1. User Roles

| Role | Description | App Surface |
|---|---|---|
| **System Admin** | Platform owner. Onboards companies/tenants and their first Company Admin. | Admin Web/App (super-admin) |
| **Company (Tenant) Admin** | Manages one canteen: staff, products, categories, departments. | Tenant Admin & Staff App |
| **Staff** | Operates the counter: toggles sold-out, fulfils orders via OTP. | Tenant Admin & Staff App |
| **Student** | End customer. Registers, browses, orders, pays, picks up with OTP. | Student App |

## 2. End-to-End Flow Summary

```
System Admin → creates Company (Tenant) → creates Company Admin user for it
Company Admin → manages Staff, Categories, Departments, Products
Staff → keeps product sold-out status current
Student → Register/Login → Browse Products → Add to Cart → Checkout →
          Choose Payment (default preselected) → Place Order →
          Payment Gateway → Success → Order Placed + OTP generated
                          → Failure → Payment Failed + "Pay Again"
Student → shows OTP at counter
Staff → enters OTP → match → Order status = Delivered
```

## 3. Functional Requirements

### FR-1: Tenant Onboarding (System Admin)
- FR-1.1: System Admin creates a **Company** record (name, contact person, mobile, email, address).
- FR-1.2: System Admin creates the first **User** for that company and assigns the **Company Admin** role.
- FR-1.3: System Admin can view/manage all companies and open/close a company (`is_open` flag) platform-wide.

### FR-2: Tenant Administration (Company Admin)
- FR-2.1: Manage users within their company: create Staff accounts, assign roles, activate/deactivate (`status`).
- FR-2.2: Manage master data scoped to their company: **Category**, **Department**.
- FR-2.3: Manage **Products**: create, update, delete (soft delete via `is_deleted`), toggle sold-out.
- FR-2.4: View/manage the company's open/closed status (`is_open`) — stops new orders when closed.

### FR-3: Staff Operations
- FR-3.1: Staff can toggle a product's `is_soldout` flag.
- FR-3.2: Staff can view incoming orders (status = `order_placed`).
- FR-3.3: Staff enters the OTP provided by the student; on match, order status changes to `delivered` and a Delivery record is created/updated.
- FR-3.4: On OTP mismatch, show an inline error; do not change order status; allow retry.

### FR-4: Student Registration & Login
- FR-4.1: First-time users register with: Name*, Username* (mobile number), Password*, Category* (dropdown), Department (dropdown, optional per data model — confirm), Email*.
- FR-4.2: Returning users log in with Username + Password.
- FR-4.3: On successful registration, redirect to Home (Product List).
- FR-4.4: On login, increment `no_of_login_attempt` on failure; lock/flag account after a configurable threshold (business rule to confirm; not specified in source PRD — recommend 5 attempts).

### FR-5: Forgot Password
- FR-5.1: User enters username → "Verify" generates a 6-character **alphanumeric** OTP, stores it in `reset_password_otp`, and sends it via Firebase Cloud Messaging push notification, and increments `no_of_login_attempt`.
- FR-5.2: Verify screen collects OTP + New Password + Retype Password.
- FR-5.3: On submit: validate OTP against `reset_password_otp`; on match, update password, reset `no_of_login_attempt` to 0, clear the OTP field.
- FR-5.4: On mismatch, show a toast/error and do not change the password.

### FR-6: Product Browsing (Student)
- FR-6.1: Home screen lists all non-deleted, non-sold-out-first products for the student's company, showing image, name, description, price.
- FR-6.2: Each product card has an **[ADD +]** control; tapping increments the quantity for that product in the in-progress cart.
- FR-6.3: A persistent bottom bar shows "N item(s) added" with a **Continue ›** action, visible once cart quantity > 0.
- FR-6.4: Sold-out products are visibly marked and cannot be added.

### FR-7: Cart & Checkout
- FR-7.1: Cart screen lists each cart line: product name, description, quantity (with +/- controls), line total.
- FR-7.2: Cart shows **Total Amount** and a **Place Order** action.
- FR-7.3: To the left of Place Order, a **payment method** selector is shown; a default method is auto-selected.
- FR-7.4: V1 fulfilment type is fixed to **Canteen Pickup** (recorded on the order; no address capture).
- FR-7.5: **Place Order** is disabled until a payment method is selected (satisfied by default auto-selection, but must remain enabled/disabled correctly if selection is ever cleared).

### FR-8: Order Placement & Payment
- FR-8.1: On "Place Order": create an **Order** with `status = payment_pending`, snapshot `items` (product_id, quantity, price) and `total_amount`.
- FR-8.2: Redirect the user to the payment gateway.
- FR-8.3: On gateway callback/webhook:
  - **Success** → verify status server-side → set `status = order_placed`, `payment_status = success`, generate a random **6-digit numeric OTP**, store in `order.OTP` → show "Order Placed Successfully" with the OTP.
  - **Failure** → set `status = payment_failed`, `payment_status = failed` → show "Payment Failed" with a **Pay Again** action (re-attempts payment on the same order; does not create a new order).
- FR-8.4: The OTP is displayed on the order confirmation/detail screen for as long as the order is not yet delivered.

### FR-9: Delivery / Pickup Fulfilment
- FR-9.1: Staff-facing screen to search/select an order and input the OTP presented by the student.
- FR-9.2: On match: order `status = delivered`; create/update a **Delivery** record with `order_status`, timestamps.
- FR-9.3: On mismatch: show error, no state change.

## 4. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Multi-tenancy | All tenant-scoped data (users, products, orders, categories, departments) must be isolated by `company_id`; a query/rule must never leak data across tenants. |
| Performance | Product list and cart interactions should feel instant (<300ms perceived) using local/optimistic state before syncing to backend. |
| Security | Passwords hashed (never stored plain) despite the raw `password` field name in the source model; OTPs are single-use and time-bound. |
| Availability | Payment status must be reconciled via webhook even if the user closes the app after redirect (do not rely solely on client-side redirect handling). |
| Auditability | All entities carry `created_by`, `updated_by`, `created_at`, `updated_at`, `is_deleted` for soft-delete and traceability. |
| Notifications | OTPs and order status updates delivered via Firebase Cloud Messaging. |

## 5. Open Questions for Business Sign-off

1. Is "Department" mandatory or optional at student registration? (Source PRD marks it without `*`, implying optional.)
2. What is the login-attempt lockout threshold and lockout duration?
3. Which payment gateway is the default for V1?
4. Can a Company Admin create other Company Admins, or only Staff?
5. Should closing a company (`is_open = false`) hide it from student login/registration, or only block new orders?
6. Is order cancellation (student-initiated, before pickup) in scope for V1?

## 6. Acceptance Criteria (Sample — Order Placement)

- **Given** a student with items in cart and a payment method selected,
  **when** they tap Place Order,
  **then** an order is created with `status = payment_pending` and the user is redirected to the payment gateway.
- **Given** the payment gateway confirms success for that order,
  **when** the backend receives the webhook/callback,
  **then** the order status becomes `order_placed`, a 6-digit numeric OTP is generated and persisted, and the student sees the OTP on screen.
- **Given** the payment gateway confirms failure,
  **when** the backend receives the callback,
  **then** the order status becomes `payment_failed` and the student sees a "Pay Again" option that resumes payment on the *same* order.
