# Feature Specification: Blue Visual Design System (Zomato-Style Food App UI)

**Feature Branch**: `013-blue-theme-visual-design`

**Created**: 2026-09-06

**Status**: Draft

**Input**: User description: "GenzFeast is a multi-tenant (multi-company) mobile food ordering platform that connects college canteens (\"companies\"/tenants) with students on their campus. Each canteen operates as an independent tenant with its own staff, products, and orders, while a central System Admin governs onboarding and platform-wide oversight. Analyse the BRD, PRD, Architecture, and UI Design docs and let the spec define a visual design theme: a blue color theme, since this is a food ordering app, using Zomato as a reference."

**Scope note**: `docs/ui-screen/06-UI-Design.md` specifies screens, navigation, and shared components (§7) but defines no visual design system — no color palette, typography scale, or component styling rules. This spec fills that gap: it defines the platform's default visual identity (a blue-anchored palette and a set of food-ordering-app UI patterns, modeled on well-known apps like Zomato) that all three app surfaces render through, and how it interacts with the per-tenant branded-build capability already established in `docs/product/01-BRD.md` (§2, note 2).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A Student Recognizes a Fast, Familiar Food-Ordering Experience (Priority: P1)

A student opening the app between classes sees an interface that looks and feels like the food-delivery apps they already use daily — appetizing product cards, a persistent cart summary, and order status they can recognize at a glance — so there is no learning curve standing between them and a quick order.

**Why this priority**: The Student App is the platform's primary, highest-traffic surface (BRD's core value proposition). Visual familiarity and speed directly serve the existing "Speed over decoration" design principle and affect adoption and repeat use.

**Independent Test**: Can be fully tested by styling the Student App's Home/Product List, Cart, and My Orders/Order Detail screens per this spec and confirming a first-time user can browse, add to cart, and identify an order's status without any explanation.

**Acceptance Scenarios**:

1. **Given** the Home / Product List screen, **When** a student views it, **Then** each product is shown as an image-led card (photo prominent, name and price below or overlaid, a clear ADD/stepper control) using the platform's defined blue-based palette and typography.
2. **Given** at least one item is in the cart, **When** the student is on any product-browsing screen, **Then** a persistent floating cart summary bar (item count, running total, "View Cart" action) remains visible without covering the product list underneath it.
3. **Given** an order in any of its lifecycle states (`payment_pending`, `order_placed`, `payment_failed`, `delivered`), **When** the student views it in My Orders or Order Detail, **Then** the status is shown as a distinctly colored badge from the platform's fixed semantic-status-color set, always paired with a text label.
4. **Given** the Home screen offers multiple product categories, **When** the student wants to narrow the list, **Then** categories are presented as compact, tappable chips/pills rather than a dropdown or separate screen.

---

### User Story 2 - Tenant Staff Get a Consistent, Professional Operating Interface (Priority: P2)

A Company Admin or Staff member managing their canteen's day-to-day operations (dashboard, products, incoming orders) sees an interface that clearly belongs to the same product as the Student App — same colors, type, and status indicators — just adapted for data-dense operational screens instead of browsing.

**Why this priority**: Operational efficiency matters for daily canteen staff use, but this surface has lower traffic and lower business impact than the student-facing ordering flow that drives adoption and revenue.

**Independent Test**: Can be fully tested by reviewing the Tenant Admin & Staff App's Dashboard, Product List, and Staff Incoming Orders screens and confirming they reuse the same color tokens, typography, and order-status badges as the Student App.

**Acceptance Scenarios**:

1. **Given** the Company Admin Dashboard, **When** viewed, **Then** the open/closed toggle and key stats use the platform's defined primary and semantic colors, not a separate ad hoc palette.
2. **Given** the Staff Incoming Orders screen, **When** an order's status changes, **Then** the same status-badge colors and shapes used in the Student App's Order Detail are reused here.

---

### User Story 3 - A Canteen's Brand Shows Through Without Breaking Consistency (Priority: P3)

A Company Admin whose canteen has its own branded build (per the platform's existing per-tenant branding capability) sees their own accent color and logo represented in their Student App build, while everything else — layout, card style, status colors, typography — still matches every other canteen's build, so the platform still feels like one coherent product underneath the branding.

**Why this priority**: This is an existing platform capability (BRD §2, note 2) this spec must not silently break or contradict; it depends on User Story 1's base theme existing first, so it ranks below it.

**Independent Test**: Can be fully tested by configuring two different tenant accent colors for two mock canteen builds and confirming both builds pass an accessibility contrast check and differ only in accent color/logo/app name, with identical layout, typography, and status colors.

**Acceptance Scenarios**:

1. **Given** a canteen has a configured brand accent color, **When** its Student App build renders, **Then** only the primary accent color, logo, and app name reflect that canteen's brand — typography, spacing, card shapes, and order-status colors are unchanged from the platform default.
2. **Given** a canteen submits a brand accent color that fails a minimum contrast check against the screens it is used on, **When** the build is generated, **Then** the platform default blue is used instead of the failing color.

---

### User Story 4 - A System Admin Can Never Mistake Platform-Wide Actions for Single-Canteen Actions (Priority: P4)

A System Admin managing companies platform-wide sees a portal that shares the same visual language as the tenant-facing apps (so it doesn't feel like an abandoned, inconsistent tool) but is clearly marked as operating at platform scope, reducing the risk of a platform-wide action being taken by mistake in what looks like a single-tenant screen.

**Why this priority**: Lowest-traffic surface, used by a small number of platform operators; correctness of scope-awareness matters more than polish, and it depends on the base theme (User Story 1) being defined first.

**Independent Test**: Can be fully tested by comparing the System Admin Portal's Company List/Create screens against the Tenant Admin & Staff App and confirming shared palette/typography but a distinct, unmistakable "platform-wide" navigation/header treatment.

**Acceptance Scenarios**:

1. **Given** the System Admin Portal, **When** compared to the Tenant Admin & Staff App, **Then** both use the same base palette and typography scale, but the System Admin Portal's header/navigation carries a distinct visual marker identifying it as platform-wide rather than company-scoped.

---

### Edge Cases

- What happens when a tenant-supplied brand accent color fails the minimum contrast requirement? The platform falls back to the default blue for that build rather than shipping illegible text (see User Story 3, Acceptance Scenario 2).
- How is order status conveyed to a colorblind student who cannot distinguish the status badge colors? The text label accompanying every status badge is the fallback — color is never the only signal (FR-003).
- What happens while a product image is still loading on a slow connection? A skeleton placeholder matching the card's shape is shown, consistent with the existing Accessibility & States checklist (`docs/ui-screen/06-UI-Design.md` §8).
- What happens when a canteen has no products, an empty cart, or no incoming orders? A themed empty state (icon/illustration + short message) is shown, not a blank screen or raw "no data" text.
- What happens on a very small or very large phone screen? The floating cart bar and bottom navigation respect device safe areas (notch, home-indicator/gesture bar) and never overlap tappable content.
- What happens when a product name is unusually long? Card text truncates with an ellipsis rather than breaking the card's fixed image-forward layout.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The platform MUST define one base color palette, anchored on a primary blue hue, used consistently across all three app surfaces (Student App, Tenant Admin & Staff App, System Admin Portal). A starting default:

  | Token | Value | Usage |
  |---|---|---|
  | `primary` | `#1565C0` (blue 800) | Primary CTAs, active nav/tab state, links |
  | `primary-variant` | `#0D47A1` (blue 900) | Pressed/active states, headers |
  | `accent` | `#29B6F6` (light blue 400) | Secondary highlights, selected chip |
  | `surface` | `#FFFFFF` | Cards, sheets |
  | `background` | `#F5F8FC` | Screen background |
  | `text-primary` | `#12202E` | Headings, body text |
  | `text-secondary` | `#5B6B7A` | Captions, secondary labels |

  Exact shades may be adjusted by a design/brand stakeholder before implementation without changing this requirement's structure.

- **FR-002**: The platform MUST define one fixed set of semantic status colors, one per order lifecycle state, used identically everywhere an order status is displayed (Student My Orders/Order Detail, Staff Incoming Orders, any admin order view):

  | Status | Color | Token |
  |---|---|---|
  | `payment_pending` | Amber | `status-pending` |
  | `order_placed` | Blue (platform primary) | `status-placed` |
  | `payment_failed` | Red | `status-failed` |
  | `delivered` | Green | `status-delivered` |

- **FR-003**: Every order-status indicator MUST pair its color with a text label; color alone MUST NOT be the only way status is conveyed.
- **FR-004**: The platform MUST define one typography scale (a fixed, small set of text sizes/weights for headings, body text, prices, and captions/labels) applied consistently across all three surfaces.
- **FR-005**: The Student App's Home/Product List screens MUST use image-forward product cards (photo prominent, name/price/ADD control below or overlaid), consistent with the existing "Speed over decoration" design principle and modeled on established food-ordering-app conventions (e.g., Zomato).
- **FR-006**: The Student App MUST show a persistent floating cart summary (item count, running total, and a "View Cart" action) on browsing screens whenever the cart is non-empty, without obscuring the product list.
- **FR-007**: The Student App's Home screen MUST present category filtering as compact, tappable chips/pills drawn from the platform's defined palette.
- **FR-008**: All primary calls-to-action across all three surfaces (Add to Cart, Place Order, Pay Now, Confirm, Save, etc.) MUST use one consistent, high-contrast button style so the main action on any screen is always visually obvious.
- **FR-009**: The platform MUST define a consistent set of empty-state and loading-state visuals (skeleton placeholders for image-heavy lists; empty-cart/no-products/no-orders states) matching the overall visual theme, extending the existing Accessibility & States checklist (`docs/ui-screen/06-UI-Design.md` §8).
- **FR-010**: ~~The System Admin Portal's navigation/header MUST carry a visually distinct "platform-wide" treatment... that differentiates it from the Tenant Admin & Staff App's company-scoped screens~~ — **revised on explicit request**: the System Admin Portal and the Tenant Admin & Staff App (Company Admin + Staff) now share the same navy/primary-variant header treatment (`secondaryHeaderOptions`, `mobile/src/theme/navigationHeader.ts`), both remaining visually distinct from the Student App's/shared Profile screen's orange header.
- **FR-011**: The platform MUST allow each canteen's Student App build to override only its primary accent color, logo, and app display name (per the existing per-tenant branded-build capability), while typography, spacing, component shapes, and semantic status colors remain fixed platform-wide.
- **FR-012**: Any tenant-supplied override color MUST meet a minimum WCAG 2.1 AA contrast ratio (4.5:1 for normal text) against the backgrounds/text it is used with before being applied to a live build; a failing color MUST fall back to the platform default blue rather than shipping an illegible build.
- **FR-013**: The platform MUST NOT introduce visual elements for capabilities explicitly out of scope for V1 (star ratings/reviews on products or canteens, delivery-address/map UI, loyalty/rewards badges), even where such elements are common in the referenced food-ordering app.
- **FR-014**: All interactive elements (buttons, chips, cards, inputs) MUST meet a minimum comfortable tappable target size and text-contrast ratio suitable for quick, one-handed use between classes.

### Key Entities *(include if feature involves data)*

- **Design Token Set**: The platform-wide, fixed set of values defined by this spec — primary/semantic color palette, typography scale, spacing and corner-radius scale. Shared identically by all three app surfaces.
- **Tenant Brand Theme**: A per-Company override of a small subset of the Design Token Set (accent color, logo asset, app display name) applied only to that company's Student App build; every other token is inherited unchanged from the Design Token Set. Relates to the `Company` entity defined in `specs/001-company-role-user-setup`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time student can correctly identify whether a past order is delivered, pending, or failed within 3 seconds of viewing My Orders, using the status badge alone.
- **SC-002**: Configuring a new canteen's custom brand accent color requires only a configuration value, not a code change, and never results in a published build with a contrast-check failure.
- **SC-003**: Across a representative sample of screens spanning all three app surfaces, 100% reuse only the colors and text sizes defined in the Design Token Set — no one-off colors or font sizes.
- **SC-004**: In first-use feedback, new students describe the app as feeling like a familiar, fast food-ordering app rather than needing an explanation of how to read the screen.

## Assumptions

- "Zomato as a reference" is interpreted as adopting well-known food-ordering-app UX conventions (image-forward product cards, a floating cart summary bar, chip-based category filters, bold high-contrast CTA buttons, color-coded status badges) — not copying Zomato's own brand color, logo, or any other Zomato-specific/copyrighted asset. GenzFeast's own primary color is blue, not Zomato's red.
- This spec defines a written design-token and UI-pattern specification (colors, type scale, spacing, component behavior), not visual mockups or design-tool files — consistent with how `docs/ui-screen/06-UI-Design.md` already documents every screen in text rather than images.
- Only the Student App participates in per-tenant branded builds (per BRD §2, note 2); the Tenant Admin & Staff App and the System Admin Portal always render the platform's fixed default theme with no per-tenant override.
- Dark mode is out of scope for V1 — no such requirement appears in the BRD, PRD, or Architecture docs.
- Zomato UI elements that map to explicitly out-of-scope V1 capabilities (ratings/reviews, delivery-address/map views, loyalty/rewards) are intentionally excluded (FR-013), even though they are common in the referenced app.
- The literal hex values proposed in FR-001/FR-002 are a reasonable starting default, adjustable by a design/brand stakeholder before implementation without changing this spec's requirements.
