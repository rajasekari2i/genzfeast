# Module 6: Checkout, Payment & Order Lifecycle

**Covers:** PRD FR-8
**Depends on:** Module 5 (cart must be built and populated)
**Build order:** 5th — must exist before Module 3 (Staff Fulfilment) can be tested

## Users
Student (client), Backend (server-authoritative)

## Screens
1. **Payment redirect / in-app browser** to the gateway.
2. **Order Success screen** — "Order Placed", shows OTP, order summary.
3. **Order Failed screen** — "Payment Failed", "Pay Again" button.

## APIs

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/orders` | Create order (`payment_pending`), returns payment session/redirect URL |
| POST | `/orders/:id/retry-payment` | Re-initiate payment on an existing `payment_failed` order |
| POST | `/webhooks/payment` | Server-to-server gateway callback; authoritative status update |
| GET | `/orders/:id` | Poll/fetch current order status + OTP for the success screen |

## Business Rules
- Order status transitions are **only** written by the backend after webhook verification (see 04-Architecture.md §6) — the client never sets `status`/`payment_status` directly.
- OTP (`orders.otp`) generated exactly once, at the `payment_pending → order_placed` transition.
- `retry-payment` must reuse the same order id and items snapshot; it must not create a duplicate order or duplicate OTP.

## Data Touchpoints (see 03-Data-Model.md)
- `orders` (create, status transitions, OTP generation)
- `companies` (check `is_open` before allowing order creation)

## Acceptance Criteria
- **Given** a non-empty cart and a selected payment method, **when** the student taps Place Order, **then** an `orders` document is created with `status = payment_pending` and the student is redirected to the payment gateway.
- **Given** a webhook reporting payment success, **when** the backend processes it, **then** `status` becomes `order_placed`, a 6-digit numeric OTP is generated and stored, and the student's Order Success screen displays it.
- **Given** a webhook reporting payment failure, **when** the backend processes it, **then** `status` becomes `payment_failed` and the student sees "Pay Again," which reuses the same order id on retry.
- **Given** a company with `is_open = false`, **when** a student attempts to place an order, **then** the API rejects the request before creating an order.
