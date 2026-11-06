# Feature Specification: Mobile App UI Refresh

**Feature Branch**: `017-ui-refresh`

**Created**: 2026-11-06 · **Re-specified**: 2026-11-06 (explicit constraints and 7-layer priority order)

**Status**: Draft

**Input**: Restyle the React Native Android app to the GenzFeast redesign canvas. UI only. Supersedes `013-blue-theme-visual-design`.

---

## Overview

GenzFeast works, but it looks like scaffolding: flat greys, system type, one corner radius, and a menu that shows barely two dishes per screen. The approved redesign gives it an identity — a warm cream ground, espresso as the serious text-and-action colour, tangerine reserved for the moments that matter, a display typeface with real hierarchy, and a two-column menu.

**This feature changes only what the user sees.** Every field, validation rule, request, route and permission check stays exactly as it is. The redesign's own foundation board states the contract: *"Fresh look, same app: every screen keeps today's fields, rules and flows. Tangerine stays the only colour a canteen can rebrand."*

This specification **supersedes `013-blue-theme-visual-design`**, whose blue palette no longer reflects the shipped app. The mechanism 013 established — one token module, one tenant-overridable colour, a build-time contrast gate — is retained; only values and structure grow.

---

## User Scenarios & Testing *(mandatory)*

> Priorities are **implementation order**. P1–P3 are foundation layers whose consumer is the next layer; P4–P7 are the user-facing journeys. Each is independently verifiable.

### User Story 1 - Design foundations exist and are the only source of truth (Priority: P1)

The shared definition of colour, typography, spacing, radius, status colours and navigation chrome exists, and every screen reads from it. Applying it shifts the whole app's colour and type with no per-screen work.

**Why this priority**: nothing else can land without it, and it is independently valuable — every screen changes the moment it exists.

**Independent Test**: launch the app; the ground, text colour and typefaces are the new ones on every screen, with no screen-level edits made.

**Acceptance Scenarios**:
1. **Given** the foundations exist, **When** any screen opens, **Then** it renders on the new ground with espresso text and the bundled typefaces.
2. **Given** a canteen supplies its own brand colour, **When** the app is built for it, **Then** that colour replaces tangerine everywhere tangerine appears, and nothing else in the palette changes.
3. **Given** a canteen supplies a brand colour that would make espresso text on it unreadable, **When** the brand is resolved, **Then** it is rejected with a warning and the default is used.
4. **Given** a developer needs a colour, size, radius or text style, **When** they look for it, **Then** the foundations define a named value for it.

---

### User Story 2 - Shared components carry the design (Priority: P2)

Buttons, status badges, the product card, the cart bar, inputs, the pickup-code display, the pickup-code entry field, the sold-out switch row and the picker surface are rebuilt on the foundations. Every screen that uses them inherits the design.

**Why this priority**: these appear on nearly every screen; rebuilding them once is what makes P4–P7 small, low-risk edits.

**Independent Test**: open any screen using each component and compare against the Foundations artboard; confirm every interactive element meets the minimum touch target.

**Acceptance Scenarios**:
1. **Given** a primary and a brand action side by side, **When** rendered, **Then** they are distinguishable by fill and text colour, both fully rounded and the same height.
2. **Given** an unavailable action, **When** rendered, **Then** it differs from an available one by **outline style as well as colour**, not colour alone.
3. **Given** an item not in the cart, **When** the add control is tapped, **Then** it becomes a quantity stepper whose decrease and increase targets each meet the minimum.
4. **Given** an order with a pickup code, **When** displayed, **Then** the six digits render as individual cells, legible at arm's length.
5. **Given** staff entering a pickup code, **When** the code is wrong, **Then** the entry boxes clear for retry and nothing about the order changes.

---

### User Story 3 - The app carries the new brand mark (Priority: P3)

The launcher icon and splash screen use the new logo, so the redesign is visible before the app even opens.

**Why this priority**: small, self-contained, and the first thing a user sees. Independent of every screen.

**Independent Test**: install the build; the launcher icon is the new mark and adapts correctly to the device's icon shape; the splash shows the new logo.

**Acceptance Scenarios**:
1. **Given** the app is installed, **When** the launcher is viewed, **Then** the new mark appears and renders correctly under the platform's adaptive-icon masking (round, squircle, square).
2. **Given** the app is launched cold, **When** the splash shows, **Then** it presents the new logo on a brand-consistent ground.

---

### User Story 4 - Signing in and signing up (Priority: P4)

Login, registration and the two forgot-password steps are in the new design. Fields, validation and messages are unchanged.

**Why this priority**: the first screens a new user sees, and the smallest coherent screen group.

**Independent Test**: register an account, sign out, sign in, and run a full password reset. Every step matches its artboard, and every field, rule and message is identical to before.

**Acceptance Scenarios**:
1. **Given** the registration screen, **When** it renders, **Then** it shows exactly today's fields — including **gender**, which the artboard omits — in today's order.
2. **Given** a validation failure, **When** the message appears, **Then** the wording is unchanged and it uses the foundations' error colour.
3. **Given** the forgot-password screens, which have no artboard, **When** they render, **Then** they use only foundation values and existing component patterns, with no new layout invented.

---

### User Story 5 - The student journey (Priority: P5)

Menu, side menu, cart, order confirmation, order detail and order history in the new design. The menu is a two-column grid; sold-out dishes are unmistakable; the pickup code is the hero of a paid order.

**Why this priority**: the journey almost every user takes, and the business case for the feature.

**Independent Test**: place an order end to end — browse, add, cart, pay, view the code, check history. Every screen matches its artboard; the order behaves exactly as today.

**Acceptance Scenarios**:
1. **Given** a canteen with six or more dishes, **When** the menu opens, **Then** dishes appear two per row and noticeably more of the menu is visible without scrolling.
2. **Given** a sold-out dish, **When** it appears, **Then** it carries an explicit stamp and an unavailable add control — not a faint dim.
3. **Given** a paid order, **When** opened, **Then** the pickup code is the most prominent element on the screen.
4. **Given** a failed payment, **When** opened, **Then** the status shows as a labelled badge with its own colour and the pay-again action is immediately obvious.
5. **Given** the side menu, **When** opened, **Then** it shows the user's **name and canteen only** — never their role.

---

### User Story 6 - Screens every role shares (Priority: P6)

Profile, edit profile, change password, Contact Us and Feedback in the new design.

**Why this priority**: reached by every role, but less often than P5; reuses components already proven there.

**Independent Test**: as each role, open all five screens; each matches its artboard (or, where none exists, the established patterns), with fields and rules unchanged.

**Acceptance Scenarios**:
1. **Given** the profile screen, **When** a read-only field renders, **Then** it is distinguishable from an editable one by border style as well as colour.
2. **Given** Contact Us, **When** phone and email render, **Then** they keep exactly the behaviour they have today — the dialler and mail client still open — and only their appearance changes, from brand-coloured underlined text to the link token.
3. **Given** the feedback form, **When** it renders, **Then** the rating, the six fixed categories and the contact-back option are unchanged.

---

### User Story 7 - Company Admin and Staff (Priority: P7)

Dashboard, product list (admin and staff variants), product form, categories, departments, users, feedback review and detail, incoming orders, fulfilment, and both back-of-house side menus.

**Why this priority**: fewer people, but longer sessions under time pressure. Last because the components are proven by then and the business impact is lower than P5.

**Independent Test**: as staff, work the queue and verify a code; as Company Admin, create and edit a product, category, department and user, and resolve a feedback item. Every screen matches its artboard and behaves as today.

**Acceptance Scenarios**:
1. **Given** the staff product list, **When** it renders, **Then** it offers **only** the sold-out switch — no create, edit or delete.
2. **Given** the fulfilment screen, **When** it renders, **Then** the pickup code is never displayed to staff; they can only submit a candidate.
3. **Given** the user form, **When** the role options render, **Then** they are Company Staff, Student, Teaching and Non-Teaching — **Company Admin is absent** — and Category is required when the role is Student.
4. **Given** a feedback item marked resolved, **When** the screen renders, **Then** there is no path back to unresolved.
5. **Given** the dashboard, **When** it renders, **Then** it contains **no open/closed toggle**.

---

### Edge Cases

- **A canteen's brand colour is dark.** Brand-filled buttons carry espresso text. The contrast check must reject such a colour — warning and falling back to the default — rather than applying it.
- **A dish has no photo.** The grid shows a designed placeholder, never a broken-image icon.
- **A dish name is long.** In a two-column grid each card is about half the previous width; names truncate on one line and descriptions to a fixed height so cards in a row stay equal.
- **A canteen has one dish, or none.** No broken half-row; the empty state is designed.
- **A bundled typeface is missing or fails to resolve.** A font file absent at build time must fail the font gate so the test suite goes red before release. A face that fails to resolve at runtime must fall back to a readable system face rather than rendering invisibly. These are different failures with different handling.
- **The device uses a large system font size.** Pickup-code digits, badges and buttons stay legible and un-clipped.
- **A very small screen.** The two-column grid still renders two readable columns at the narrowest supported width.
- **An order status outside the four designed ones.** It renders a readable, non-blank label rather than an empty badge.

---

## Requirements *(mandatory)*

### Functional Requirements — Foundations (P1)

- **FR-001**: The app MUST define a single shared set of design foundations — colours, typefaces, text styles, spacing, radii, status colours and navigation chrome — that every screen and component reads from.
- **FR-002**: No screen or component MUST define a colour, text style or corner radius the foundations already define, **whether as a literal value or as a styling class name drawn from outside the foundations**. A class resolving to an off-palette colour is as much a violation as a hardcoded one.
- **FR-003**: The palette MUST comprise: **Tangerine `#FF6B35`** (brand), **Espresso `#2B1D16`** (primary text and primary action fill), **two grounds** — **Cream `#FFF8F1`** for student-facing screens and **warm grey `#F5F3EF`** for back-of-house screens — **Navy `#183153`** (admin and staff chrome), **Sun `#FFC857`** (highlights), **Mint `#0B7A55`** (veg), plus the supporting neutrals `#4A4756`, `#5B5866`, `#F1E6DA`, `#EFE3D6`, `#CFC6BB`, `#F4EEE7`, `#6E6A78`, `#D6D4DD` and link `#B23C0E`.
- **FR-003a**: Soft-accent pairs MUST be defined once and reused by status badges, icon tiles and product-image tints alike, across seven families: tangerine, sun, mint, red, violet, blue and neutral. No component may define its own accent colour.
- **FR-003b**: The palette MUST additionally define a **scrim** (overlay) and a **shadow** (elevation) colour. Both name values already present in the shipped app; neither changes any pixel.
- **FR-004**: Order status MUST be presented as a labelled badge with a matching dot, in four defined pairings: payment pending `#FFF1D6`/`#8A5300`/`#F59E0B`; order placed `#FFE6DA`/`#B23C0E`/`#FF6B35`; payment failed `#FDE2E1`/`#B42318`/`#DC2626`; delivered `#DDF4EA`/`#0B6B4B`/`#16A34A`.
- **FR-005**: Dietary marks MUST use mint `#0B7A55` for veg and `#9A3412` for non-veg, each a bordered glyph differing in **shape as well as colour**.
- **FR-006**: The app MUST render **Bricolage Grotesque** for display text and **Inter** for body text, both shipped with the app so they render without network access.
- **FR-007**: The text scale MUST provide fifteen styles across the two families: display family at `hero` 36, `display` 34, `title` 28, `titleSm` 24, `subtitle` 20, `subtitleSm` 17; body family at `price` 16, `bodyLg` 16, `body` 15, `bodyBold` 15, `labelLg` 14, `label` 13, `eyebrow` 12 (uppercase, widened tracking), `caption` 12, `captionSm` 11.
- **FR-007a**: Because the platform selects a bundled face by **file name** rather than numeric weight, each weight MUST ship as its own font family, and **no numeric font weight may be set anywhere** — not in a text style, not as a styling class, not in navigation header options. Weight is carried by the family alone. A style setting both a bundled family and a weight of 700 or above silently renders in the system font, with no error at compile or build time.
- **FR-008**: The corner-radius scale MUST provide twelve steps: 3 (dietary glyph), 8, 10, 12, 14, 16, 18, 20, 22, 24, 28 and fully-rounded.
- **FR-009**: **Tangerine MUST remain the only value a canteen can override.** Every other foundation value MUST be identical across all canteens.
- **FR-010**: A canteen brand colour MUST be evaluated against **exactly one pairing** — espresso text on the brand fill, ≥4.5:1. A failing colour warns and falls back to the default; it does not fail the build. A brand-as-foreground leg MUST NOT be added: requiring both is mathematically unsatisfiable, since it demands a colour simultaneously light enough to carry espresso text and dark enough to read on cream.
- **FR-011**: Navigation chrome MUST be defined centrally, with back-of-house surfaces using navy and student surfaces using the student ground.

### Functional Requirements — Shared components (P2)

- **FR-012**: A primary action MUST render as a fully-rounded espresso button with light text; a brand action as a fully-rounded brand-filled button with espresso text.
- **FR-013**: An unavailable action MUST be distinguishable by **outline style as well as colour**.
- **FR-014**: The add-to-cart control MUST become a quantity stepper once the item is in the cart.
- **FR-015**: Every interactive control MUST present a touch target of at least 44 units in both dimensions, **including where an artboard shows less**.
- **FR-016**: A text field MUST carry the defined height, radius and border; a read-only field MUST be distinct by **border style and fill, not colour alone**.
- **FR-017**: The pickup code MUST render as six individual digit cells on a dark panel.
- **FR-018**: Pickup-code **entry** MUST render as six segmented boxes which clear on an incorrect code so the operator can retry.
- **FR-019**: The sold-out control MUST render as a labelled switch row.
- **FR-020**: Selection of a category, department or role MUST use the shared picker surface rather than a bespoke control per screen.
- **FR-021**: A content card MUST render on a light fill with the defined radius and a hairline border.

### Functional Requirements — Brand (P3)

- **FR-022**: The launcher icon MUST use the new mark and MUST render correctly under the platform's adaptive-icon masking.
- **FR-023**: The splash screen MUST present the new logo on a brand-consistent ground.

### Functional Requirements — Screens (P4–P7)

- **FR-024**: Each of the 26 artboards MUST be matched by its corresponding screen in layout, hierarchy and component usage.
- **FR-025**: The menu MUST present dishes in a two-column grid.
- **FR-026**: A sold-out dish MUST carry an explicit stamp and an unavailable add control.
- **FR-027**: Side menus MUST display the signed-in user's **name and canteen only**. They MUST NOT display the user's role.
- **FR-028**: The three side-menu variants MUST be driven by the signed-in user's role exactly as they are today, with identical menu items per role.
- **FR-029**: Screens with no artboard — forgot-password request, forgot-password verify, change password, edit profile, app launch, and product create/edit — MUST be restyled using only the foundations and shared components, with **no new layout patterns invented**.

### Functional Requirements — Preservation (binding across all priorities)

- **FR-030**: No screen's fields, field order, labels, validation rules or error messages MUST change.
- **FR-031**: No navigation **route name or parameter**, screen-to-screen transition, or role-based routing rule MUST change.
- **FR-032**: No request the app makes, and no data it sends or expects, MUST change. The generated API type definitions MUST NOT be modified.
- **FR-033**: No backend code MUST be modified.
- **FR-034**: No business rule — ordering, payment, fulfilment, permissions — MUST change.
- **FR-035**: Every screen that exists today MUST still exist, and **no new screen MUST be added**.

### Functional Requirements — Explicit non-goals (verifiable prohibitions)

These exist because the restyle creates an opportunity to add them. Each is a **defect if implemented**.

- **FR-036**: A canteen open/closed toggle MUST NOT be added.
- **FR-037**: Search or filtering of the menu MUST NOT be added.
- **FR-038**: Tap-to-call and tap-to-email MUST NOT be **added**. Note the shipped app already opens the dialler and mail client from Contact Us (added by `specs/015-contact-us-page` FR-010). That existing behaviour is **preserved** — removing it would itself be a behavioural change, which FR-030 forbids. This requirement bars introducing the affordance anywhere it does not already exist.
- **FR-039**: A Company Admin MUST NOT gain the ability to create or edit another Company Admin.
- **FR-040**: Category MUST remain required when creating or registering a Student.
- **FR-041**: Feedback resolution MUST remain one-way; no path back to unresolved may be added.

### Key Entities

- **Design foundation set**: the single shared definition of colour, typography, spacing, radius, status colours and chrome. One per app; overridable by exactly one value per canteen.
- **Canteen brand override**: a canteen-supplied brand colour applied at build time, subject to a contrast gate.
- **Artboard**: one approved screen design. 27 exist — 26 map to existing screens, 1 is the foundation reference.

---

## Success Criteria *(mandatory)*

- **SC-001**: A diner sees at least **three times as many dishes** without scrolling as in the current single-column menu.
- **SC-002**: **100% of the app's screens** render in the new design language — all 27 screen files plus the role-routed navigation shell, including the six with no artboard.
- **SC-003**: **Zero behavioural differences** are observable: every field, validation message, action outcome, route and permission is identical.
- **SC-004**: **Zero hardcoded design values and zero off-foundation styling class names** remain in screens or components. A class that silently stops applying, or that silently applies an off-palette colour, counts as a failure.
- **SC-005**: All body text meets a contrast ratio of **at least 4.5:1**; large text at least **3:1**.
- **SC-006**: Every interactive control meets the **44-unit minimum touch target**.
- **SC-007**: A reviewer comparing each of the 26 artboards against its screen finds **no layout or hierarchy mismatch**.
- **SC-008**: A brand colour that would render espresso text unreadable is rejected and replaced with the default, with a warning; and **at least one non-default brand colour is demonstrably accepted**, proving the override path still works.
- **SC-009**: The sold-out state is correctly identified by **every participant** in an informal review, without prompting.
- **SC-010**: **None of the six prohibited features (FR-036 … FR-041) is present** in the shipped build.

---

## Assumptions

- **The canvas governs appearance; the shipped app governs behaviour.** Where an artboard implies different fields, copy or logic, the shipped app wins and the difference is recorded rather than implemented.
- **The Register artboard omits the required gender field.** It is retained and styled to match the artboard's own segmented-chip pattern.
- **The `OrderSuccess` artboard is a state, not a screen** — it specifies how the existing order-detail screen looks once paid. No new screen or route is created.
- **The three side-menu artboards are role variants of the one existing side menu**, not three separate menus.
- **Artboards are drawn at a single phone size** and are treated as proportional intent, realised responsively rather than reproduced at fixed pixel sizes.
- **The brand-override resolver is dormant** — it has no production call site and no tenant brand configuration exists in the repository. This feature corrects its contrast logic; it does not wire it up, which would be new non-visual behaviour. Scenarios about a tenant colour being applied are verified as unit assertions, not on a device.
- **Bundling the typefaces requires a platform build change**, so a fresh install is needed rather than a reload. **Reverting the feature therefore also requires a new build** — there is no partial rollback.
- **Android is the only target**; no iOS project exists.
- **Styling is applied through utility class names, not only through the token module.** Changing or removing a class name screens already use is a breaking change even when nothing fails to compile.
- **Dark mode is not in scope.** The redesign defines a single light appearance.
- **No automated visual-regression tooling exists**, so artboard fidelity is verified by structured human review against each artboard rather than by snapshot tests.
