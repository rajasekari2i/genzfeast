# Contract: Design Token Set

This is the contract every screen and shared component in `mobile/` must consume — no component may hardcode a color, font size, spacing, or radius value outside this set (spec SC-003). Implemented as the default export shape of `mobile/src/theme/tokens.ts`.

## Colors

| Token | Default value | Consumers |
|---|---|---|
| `colors.primary` | `#1565C0` | Primary buttons, active nav/tab, links, System Admin header base |
| `colors.primaryVariant` | `#0D47A1` | Pressed/active states, screen headers |
| `colors.accent` | `#29B6F6` | Selected category chip, secondary highlights |
| `colors.surface` | `#FFFFFF` | Cards, bottom sheets, the cart summary bar |
| `colors.background` | `#F5F8FC` | Screen background |
| `colors.textPrimary` | `#12202E` | Headings, body text, prices |
| `colors.textSecondary` | `#5B6B7A` | Captions, secondary labels, placeholder text |
| `colors.border` | `#E2E8F0` | Card/chip/skeleton borders and dividers; also the disabled-control fill (`PrimaryButton`'s disabled state) — the palette's one neutral gray, added during WU2 implementation once component work revealed the original 7-color table had no border/neutral token |

`colors.primary` is the **only** color token overridable per tenant (see `tenant-brand-config.schema.json`); every other color token is fixed platform-wide.

## Status Colors

| Order status | Color | Label shown |
|---|---|---|
| `payment_pending` | Amber `#F9A825` | "Payment Pending" |
| `order_placed` | Blue (== `colors.primary`, platform default, not tenant-overridden even on a branded build) | "Order Placed" |
| `payment_failed` | Red `#D32F2F` | "Payment Failed" |
| `delivered` | Green `#2E7D32` | "Delivered" |

Consumed by `StatusBadge` in Student My Orders/Order Detail, Staff Incoming Orders, and any admin order view. `order_placed` deliberately does not track a tenant's overridden `colors.primary`, so status meaning never depends on which tenant's build is running (spec FR-002).

## Typography Scale

| Style | Size (sp) | Weight | Line height (sp) | Usage |
|---|---|---|---|---|
| `h1` | 24 | 700 (bold) | 32 | Screen titles |
| `h2` | 18 | 700 (bold) | 24 | Section headers, product card name |
| `body` | 14 | 400 (regular) | 20 | Default body text |
| `bodyBold` | 14 | 600 (semibold) | 20 | Emphasized body text |
| `price` | 16 | 700 (bold) | 22 | Product/cart prices |
| `caption` | 12 | 400 (regular) | 16 | Secondary labels, timestamps |
| `button` | 15 | 600 (semibold) | 20 | Button labels |

## Spacing Scale (dp)

| Token | Value |
|---|---|
| `xs` | 4 |
| `sm` | 8 |
| `md` | 16 |
| `lg` | 24 |
| `xl` | 32 |

## Radius Scale (dp)

| Token | Value | Usage |
|---|---|---|
| `sm` | 4 | Input fields |
| `md` | 12 | Cards |
| `lg` | 20 | Bottom sheets, the cart summary bar |
| `pill` | 999 | Category chips, primary buttons |
