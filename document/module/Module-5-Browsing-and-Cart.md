# Module 5: Product Browsing & Cart (Student)

**Covers:** PRD FR-6, FR-7
**Depends on:** Module 2 (products must exist), Module 4 (student must be logged in)
**Build order:** 4th

## Users
Student

## Screens
1. **Home / Product List** — grid or list of products (image, name, description, price, ADD + control), sticky bottom "N items · Continue ›" bar.
2. **Cart** — line items with qty +/-, per-line total, grand total, payment method selector, Place Order button.

## APIs

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/products?company_id=...` | List active (non-deleted) products, sold-out flagged |
| (client-local state) | — | Cart is held client-side until checkout; no backend cart persistence needed for V1 |

## Business Rules
- Sold-out products are visible but the ADD control is disabled.
- Cart quantity changes are purely client-side until "Place Order" is tapped (per PRD flow) — no draft-order writes to Firestore.
- Payment method list is currently a single default option (V1 constraint — one gateway); UI should still render the selector to support future gateways without redesign.

## Data Touchpoints (see 03-Data-Model.md)
- `products` (read-only)

## Acceptance Criteria
- **Given** the product list contains a sold-out item, **when** the student views Home, **then** that item shows a "Sold Out" badge and its ADD control is disabled.
- **Given** the student adds one or more items via ADD +, **when** the cart quantity is greater than zero, **then** the bottom bar shows "{N} item(s) added" with a working "Continue ›" action to the Cart screen.
- **Given** the Cart screen, **when** the student adjusts a line item's quantity, **then** the line total and grand Total Amount update immediately without a network call.
