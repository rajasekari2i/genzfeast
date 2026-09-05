# UI Design Document
## GenzFeast — Screen Specifications & Navigation

## 1. App Surfaces

| App | Primary Users |
|---|---|
| System Admin Portal | System Admin |
| Tenant Admin & Staff App | Company Admin, Staff |
| Student App (per-tenant branded build) | Student |

## 2. Design Principles

- **Speed over decoration**: this is a between-classes ordering flow — minimize taps from "open app" to "order placed."
- **Always show the pickup OTP** once generated; never hide it behind a notification-only delivery.
- **Sold-out is obvious, not just disabled** — gray out + "Sold Out" badge, not just a dimmed button.
- **One default payment path** — reduce V1 decision-making; the selector exists but pre-fills.

## 3. Student App — Navigation Map

```
Splash
  └─ Login ──────────────► Home (Product List) ◄────────────────┐
       │  "Forgot password?"        │        │   │               │
       ▼                            │        │   │  Icon: Profile│
  Forgot Password (request)         ▼        │   ▼               │
       │                       Bottom bar:   │  Profile (View) ──┘
       ▼                       "N items · Continue ›"  │  │
  Forgot Password (verify) ──►      │        │         │  └─ Change Password
       (back to Login)              ▼        │         └─ Edit Profile (Dept/Email)
                                   Cart       │
                                    │         │  Icon: My Orders
                                    │         ▼
                                    │    My Orders (Upcoming / History tabs)
                                    │         │
                                    │         ▼
                                    │    Order Detail (OTP / Pay Again / Delivered info)
                                    │  Place Order
                                    ▼
                            Payment Gateway (external/webview)
                                    │
                     ┌──────────────┴──────────────┐
                     ▼                              ▼
             Order Success (+OTP)            Order Failed (Pay Again)
                     │                              │
                     └──────────► also reachable via My Orders → Order Detail
Register ──► (auto-login) ──► Home
```

## 4. Screen Specs — Student App

### 4.1 Registration
| Field | Type | Validation |
|---|---|---|
| Name | text | required |
| Username | numeric text (mobile) | required, 10 digits, unique per tenant |
| Password | password | required, min length policy |
| Category | dropdown | required, sourced from `categories` |
| Department | dropdown | optional (pending business confirmation) |
| Email | email | required, valid email format |

CTA: **Register** → on success, auto-login → navigate to Home.

### 4.2 Login
- Fields: Username, Password.
- CTA: **Login**.
- Footer link: **Forgot password?**
- Error state: invalid credentials → inline error + `no_of_login_attempt` incremented server-side (not shown to user).

### 4.3 Forgot Password — Request
- Field: Username.
- CTA: **Click to Verify** → triggers OTP generation + FCM push, navigates to Verify screen.

### 4.4 Forgot Password — Verify
- Fields: OTP, New Password, Retype Password.
- Client-side check: New Password == Retype Password before submit.
- CTA: **Submit** → server validates OTP → success toast + navigate to Login; failure → error toast, stay on screen.

### 4.5 Home / Product List
- Layout: vertical scroll list or 2-column grid of Product Cards.
- **Product Card**: image (top), name, short description, price, `[ADD +]` control (becomes a stepper `– N +` once quantity > 0). Sold-out cards show a "Sold Out" ribbon and disable the control.
- **Persistent bottom bar** (appears when cart qty > 0): `"{N} item(s) added"` + `Continue ›` (navigates to Cart).
- **Top bar**: canteen/tenant name + **My Orders** icon and a **Profile** icon (top-right) navigating to their respective screens.

### 4.6 Cart
- List of cart lines: name, description (truncated), unit price, qty stepper `– N +`, line total.
- Divider, then:
  - **Total Amount**: sum of line totals.
  - **Fulfilment note**: "Canteen Pickup" (static label, V1).
  - **Payment method selector** (left of Place Order): shows the single default gateway pre-selected as a chip/radio.
  - **Place Order** button (right-aligned): disabled if cart is empty or no payment method selected; enabled otherwise.

### 4.7 Payment (Gateway Webview/Redirect)
- Standard gateway-hosted checkout UI (out of GenzFeast's design control).

### 4.8 Order Success
- Big success icon + "Order Placed!"
- Order summary (items, total).
- **Pickup OTP** shown large and copyable: `"Show this OTP at the counter: 482913"`.
- CTA: **Back to Home**.

### 4.9 Order Failed
- Icon + "Payment Failed."
- CTA: **Pay Again** (resumes payment on same order) and **Back to Home**.

### 4.10 Profile (View) *(new — Module 7)*
- Detail card/list showing: Name (read-only), Username (read-only), Department, Email.
- **Edit** button → Edit Profile screen.
- **Change Password** link/button → Change Password screen.
- **Logout** action, typically placed at the bottom of this screen.

### 4.11 Edit Profile *(new — Module 7)*
- Editable fields: **Department** (dropdown, pre-filled), **Email** (text, pre-filled).
- Read-only/disabled fields shown for context: Name, Username — visible but not editable, so the student understands why they can't tap into them.
- CTA: **Save** → validates email format → updates → returns to Profile with a success toast.
- Error state: inline validation error on Email; server error → toast, no partial save.

### 4.12 Change Password *(new — Module 7)*
- Fields: **Current Password**, **New Password**, **Retype New Password**.
- Client-side check: New Password == Retype New Password before submit.
- CTA: **Update Password** → on success, toast "Password updated. You've been logged out of other devices." → return to Profile.
- Error state: incorrect Current Password → inline error, no change made, field(s) clear for retry.

### 4.13 My Orders (List) *(new — Module 8)*
- Two tabs/segments at the top: **Upcoming** and **History**.
- **Upcoming**: cards for orders in `payment_pending`/`order_placed`, most relevant first. Each card: short order reference, item summary (e.g., "2x Samosa, 1x Chai"), total, status badge, placed time.
- **History**: cards for `delivered`/`payment_failed`/`cancelled` orders, most recent first, same card layout.
- Tapping any card navigates to Order Detail.
- Empty states: "No upcoming orders" (Upcoming tab) / "No past orders yet" (History tab).

### 4.14 Order Detail *(new — Module 8)*
- Header: status badge + short order reference + placed date/time.
- Itemized list (from the order's own stored snapshot): product name, quantity, unit price, line total.
- **Total Amount**, **Fulfilment**: "Canteen Pickup."
- Status-specific content:
  - `payment_pending` → "Payment in progress" banner + Check Status / Resume Payment.
  - `order_placed` → large, copyable **Pickup OTP** (same treatment as Order Success, §4.8).
  - `payment_failed` → "Payment Failed" banner + **Pay Again**.
  - `delivered` → "Delivered" banner + delivery timestamp.
  - `cancelled` → "Cancelled" banner, no action (V1).

## 5. Screen Specs — Tenant Admin & Staff App

### 5.1 Company Admin: Dashboard
- Canteen open/closed toggle (prominent, top of screen).
- Quick links: Staff, Categories, Departments, Products.

### 5.2 Company Admin: Product List
- Table/list: image thumb, name, price, veg/non-veg icon, Sold-Out toggle switch, Edit icon.
- Floating action button: **+ Add Product**.

### 5.3 Company Admin: Product Create/Edit
- Fields: Name, Description, Image (upload/camera/gallery), Price, Is Veg (toggle).
- CTA: **Save**.

### 5.4 Company Admin: Staff / Category / Department management
- Simple list + create/edit form pattern, consistent across all three (name field(s) only, per data model).

### 5.5 Staff: Sold-Out Toggle View
- Same Product List as 5.2, but read/toggle-only (no create/edit/delete permissions).

### 5.6 Staff: Incoming Orders
- List of orders (order id short code, item count, total, time placed), tap to open.

### 5.7 Staff: Order Fulfilment
- Order detail (items, total).
- **OTP input field** (numeric, 6-digit) + **Verify & Deliver** button.
- Success: banner "Delivered" + auto-return to Incoming Orders.
- Failure: inline error "OTP does not match," field clears for retry.

## 6. Screen Specs — System Admin Portal

### 6.1 Company List
- Table: name, contact person, mobile, is_open status, actions (Edit, Create Admin).

### 6.2 Company Create/Edit
- Fields: Name, Contact Person, Mobile, Email, Address.

### 6.3 Create Company Admin
- Fields: Name, Username, temp Password, Email.
- Note/helper text: "This user will be able to manage this company's staff and products."

## 7. Shared UI Components

| Component | Used in |
|---|---|
| Product Card (with ADD/stepper) | Home, Cart-adjacent recommendations (future) |
| OTP Input (6-box or single field) | Forgot Password Verify, Staff Order Fulfilment |
| Status Badge (`payment_pending`/`order_placed`/`payment_failed`/`delivered`) | Order Success/Failed, Staff Orders list |
| Read-only Field (disabled input, styled distinctly from editable fields) | Edit Profile (Name, Username) |
| Empty States | Empty cart, no products, no incoming orders |
| Toast/Snackbar | All error/success micro-feedback (OTP mismatch, save success, password updated, etc.) |

## 8. Accessibility & States Checklist (per screen)

- Loading state (skeleton or spinner) while fetching products/orders.
- Empty state (no products / empty cart / no orders).
- Error state (network failure, validation failure).
- Disabled state clearly distinct from enabled (Place Order, sold-out ADD button).
