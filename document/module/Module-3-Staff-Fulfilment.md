# Module 3: Staff Fulfilment

**Covers:** PRD FR-3, FR-9
**Depends on:** Module 6 (orders must exist to be fulfilled)
**Build order:** Last — needs live orders to test against

## Users
Staff

## Screens
1. **Product Sold-Out Toggle** — reuse of Product List filtered to a simple flip switch per item.
2. **Incoming Orders Queue** — list of orders with `status = order_placed` for the company.
3. **Order Fulfilment / OTP Entry** — select an order, enter OTP, submit.

## APIs

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/staff/orders?status=order_placed` | Incoming order queue |
| POST | `/staff/orders/:id/verify-otp` | Verify OTP; on match → set `delivered`, write `deliveries` record |

## Business Rules
- OTP verification must happen server-side (Cloud Function/API), never compare OTP purely on-device.
- On mismatch, return a generic error (do not reveal the correct OTP) and log the attempt for audit.
- On match, `deliveries.verified_by` = the authenticated staff user id.

## Data Touchpoints (see 03-Data-Model.md)
- `orders` (read queue, update `status` to `delivered`)
- `deliveries` (create/update record with `order_status`, `verified_by`)
- `products` (sold-out toggle, shared with Module 2)

## Acceptance Criteria
- **Given** an order with `status = order_placed`, **when** staff enters the correct OTP, **then** the order's `status` becomes `delivered` and a `deliveries` record is created with `verified_by` set to the staff member.
- **Given** an incorrect OTP entry, **when** staff submits it, **then** the order status is unchanged, an inline error is shown, and the field is cleared for retry.
- **Given** an order already `delivered`, **when** staff attempts to verify its OTP again, **then** the API rejects the request (OTP is single-use).
