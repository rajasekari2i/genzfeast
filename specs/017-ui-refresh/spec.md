# Feature Specification: Mobile App UI Refresh

**Feature Branch**: `017-ui-refresh`

**Created**: 2026-11-06

**Status**: Draft

**Input**: User description: "Visual-only UI refresh of the GenzFeast mobile app to match the GenzFeast App Redesign canvas (27 artboards). Every screen keeps today's fields, rules and flows. No backend, API, navigation or behaviour changes."

---

## Overview

GenzFeast's mobile app works, but it looks like scaffolding: flat greys, system type, one uniform corner radius, and a product list that shows barely two items per screen. A canteen is a competitive, impression-driven setting — a student deciding between the queue and the app decides in seconds.

The approved redesign gives the product a deliberate identity: a warm cream ground, espresso as the serious text-and-action colour, tangerine reserved for the moments that matter, a display typeface with real hierarchy, and a two-column menu that shows six dishes where it used to show two.

This feature changes **only what the user sees**. Every field, validation rule, permission check, request and navigation path stays exactly as it is today. The redesign's own foundation board states the contract: *"Fresh look, same app: every screen keeps today's fields, rules and flows. Tangerine stays the only colour a canteen can rebrand."*

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The design foundations exist and are the only source of truth (Priority: P1)

A designer or developer opens the app and sees the new brand language applied consistently: the cream ground, espresso text, the two typefaces, the full corner-radius scale and the shared component shapes. Any screen built from these foundations inherits the look automatically, and no screen can drift by hardcoding its own colour or size.

**Why this priority**: Nothing else in this feature can land without it. Every subsequent story is an application of these foundations; shipping them first means every later screen is a small, low-risk change rather than a bespoke one. It is also independently valuable: on its own it already shifts the whole app's colour and type, because every screen reads from the shared definitions.

**Independent Test**: Launch the app and move through any existing screen. The ground is cream, body text is espresso rather than grey, and the display typeface renders on headings. The foundations define a named value for every colour, text style and radius the design uses. *(Whole-tree discipline — that no screen still defines its own value — is only achievable once every screen has been restyled, so it is asserted at the end of P4, not here.)*

**Acceptance Scenarios**:

1. **Given** the foundations are in place, **When** any existing screen is opened, **Then** it renders on the cream ground with espresso text and the new typefaces, with no further per-screen work.
2. **Given** a canteen has supplied its own brand colour, **When** the app is built for that canteen, **Then** that colour replaces tangerine everywhere tangerine appears, and no other part of the palette changes.
3. **Given** a canteen supplies a brand colour that would make text on a brand-filled button unreadable, **When** the brand is resolved, **Then** the colour is rejected with a warning and the default brand is used instead — an unreadable colour is never applied.
4. **Given** a developer adds a new screen, **When** they need a colour, size, radius or text style, **Then** a named foundation value exists for it.

---

### User Story 2 - A student sees a menu worth ordering from (Priority: P2)

A student opens the app between classes. The menu shows a two-column grid of dishes with clear photos, veg and non-veg marks, prices and a prominent ADD control. Sold-out dishes are unmistakably unavailable — stamped, not faintly dimmed. Adding items, reviewing the cart, paying and receiving the pickup code all look like one designed product, and the pickup code is the visual hero of a paid order.

**Why this priority**: This is the journey that the overwhelming majority of users take, and the one where appearance most directly drives whether the app gets used instead of the queue. It is the business case for the whole feature.

**Independent Test**: Sign in as a student and complete a full order — browse, add, cart, pay, view the pickup code, check order history, open a profile. Every screen matches its artboard. The order completes exactly as it does today.

**Acceptance Scenarios**:

1. **Given** a canteen with six or more dishes, **When** the student opens the menu, **Then** dishes appear two per row, and noticeably more of the menu is visible without scrolling than before.
2. **Given** a dish is sold out, **When** it appears in the menu, **Then** it carries a clear sold-out stamp and its add control is unavailable — not merely faded.
3. **Given** an order has been paid for, **When** the student opens it, **Then** the six-digit pickup code is the most prominent element on the screen, each digit individually legible at arm's length.
4. **Given** an order has failed payment, **When** the student opens it, **Then** the status is shown as a labelled chip with its own colour and a dot, and the pay-again action is immediately obvious.
5. **Given** a student performs any action in this journey, **When** the action completes, **Then** the outcome is identical to the current app in every respect other than appearance.

---

### User Story 3 - Staff and Company Admins get the same designed product (Priority: P3)

A counter staff member works the incoming-orders queue and verifies pickup codes; a Company Admin manages products, categories, departments, users and the feedback queue. Both see the same visual language as students, with the navy chrome that distinguishes back-of-house work, and forms that are legible under canteen lighting at speed.

**Why this priority**: Fewer people, but they are in the app for longer and under more time pressure than students. It is deliberately after the student journey because the business impact is lower, and because these screens reuse components proven in Story 2.

**Independent Test**: Sign in as staff, then as a Company Admin. Work through the queue, verify a code, and create and edit a product, category, department and user. Every screen matches its artboard and behaves exactly as it does today.

**Acceptance Scenarios**:

1. **Given** staff open the incoming-orders queue, **When** orders are waiting, **Then** each is a card in the new language, ordered as it is today.
2. **Given** staff enter a pickup code, **When** it matches, **Then** fulfilment completes as today; **When** it does not match, **Then** the error is shown in the new language and nothing changes.
3. **Given** a Company Admin opens any management list, **When** the list loads, **Then** rows, actions and empty states follow the shared component patterns.
4. **Given** a Company Admin opens a create or edit form, **When** a field is read-only, **Then** it is visibly distinguishable from an editable field without relying on colour alone.

---

### User Story 4 - No screen is left behind (Priority: P4)

A user who forgets their password, changes it, edits their profile, launches the app cold, or (as an admin) adds a product, sees the same designed product as everywhere else — even though the redesign supplied no artboard for these screens.

**Why this priority**: Last because these are lower-traffic screens, but genuinely required: without it the app is visibly two-tone, and the screens left behind are disproportionately ones users reach when already frustrated (a forgotten password). These are restyled by applying the established foundations and component patterns — no new layouts are invented.

**Independent Test**: Visit each of the six screens without an artboard and confirm none of them still shows the old grey-on-white treatment, and that each uses only components and values defined by the foundations.

**Acceptance Scenarios**:

1. **Given** any screen without a supplied design, **When** it is opened, **Then** it uses the cream ground, espresso text, the new typefaces and the shared component shapes.
2. **Given** a screen without a supplied design, **When** it is reviewed against the artboards, **Then** its field order, labels, validation messages and actions are unchanged from today.
3. **Given** the whole app is reviewed end to end, **When** moving between any two screens, **Then** no screen looks like it belongs to the previous design.

---

### Edge Cases

- **A canteen's brand colour is dark.** Brand-filled buttons place espresso text on the brand colour. A dark brand colour makes that unreadable. The contrast check must evaluate this pairing and reject the colour — warning and falling back to the default — rather than applying it.
- **A dish has no photo.** The menu grid must show a designed placeholder, not an empty box or a broken-image icon.
- **A dish name is long.** In a two-column grid each card is roughly half the previous width. Names must truncate cleanly on one line and descriptions to a fixed height, so cards in a row stay the same height.
- **A canteen has one dish, or none.** The grid must not leave a visually broken half-row, and the empty state must be designed.
- **A bundled typeface is missing or fails to resolve.** A font file absent at build time must fail the `theme/fonts.spec` gate, so `npm test` goes red before release. A face that fails to resolve at runtime must fall back to a readable system face rather than rendering invisibly or collapsing layout. These are different failures with different handling, and the distinction must be explicit.
- **The device is set to a large system font size.** Pickup-code digits, status chips and buttons must remain legible and un-clipped.
- **A very small screen.** The two-column grid must still render two readable columns at the narrowest supported width.
- **A status value outside the four designed ones.** Any order status without a designed chip must still render a readable, non-blank label.

---

## Requirements *(mandatory)*

### Functional Requirements

**Foundations**

- **FR-001**: The app MUST define a single shared set of design foundations — colours, typefaces, text styles, spacing and corner radii — that every screen and component reads from.
- **FR-002**: No screen or component MUST define a colour, text style or corner radius that the shared foundations already define — whether as a literal value **or as a styling class name drawn from outside the foundations**. A class that resolves to an off-palette colour is as much a violation as a hardcoded one.
- **FR-003**: The palette MUST comprise: tangerine `#FF6B35` (brand), espresso `#2B1D16` (primary text and primary action fill), **two grounds** — cream `#FFF8F1` for student-facing screens and warm grey `#F5F3EF` for back-of-house (Company Admin and Staff) screens — navy `#183153` (back-of-house chrome), sun `#FFC857` (highlights), mint `#0B7A55` (veg), plus the supporting neutrals `#4A4756`, `#5B5866`, `#F1E6DA`, `#EFE3D6`, `#CFC6BB`, `#F4EEE7`, `#6E6A78`, `#D6D4DD` and link `#B23C0E`.
- **FR-003a**: Soft-accent pairs MUST be defined once and reused by status chips, icon tiles and product-image tints alike, in seven families: tangerine, sun, mint, red, violet, blue and neutral. No component may define its own accent colour.
- **FR-004**: Order status MUST be presented as a labelled chip with a matching dot, in four defined pairings: payment pending `#FFF1D6`/`#8A5300`/`#F59E0B`; order placed `#FFE6DA`/`#B23C0E`/`#FF6B35`; payment failed `#FDE2E1`/`#B42318`/`#DC2626`; delivered `#DDF4EA`/`#0B6B4B`/`#16A34A`.
- **FR-005**: Dietary marks MUST use mint `#0B7A55` for veg and `#9A3412` for non-veg, each a bordered glyph that differs in shape as well as colour.
- **FR-006**: The app MUST render a display typeface (Bricolage Grotesque) for headings and a body typeface (Inter) for everything else, both shipped with the app so they render without network access.
- **FR-007**: The text scale MUST provide fifteen styles across two families. The display family (Bricolage Grotesque) MUST be used at a single weight for `hero` 48, `display` 34, `title` 28, `titleSm` 24, `subtitle` 20 and `subtitleSm` 17. The body family (Inter) MUST provide `price` 16, `bodyLg` 16, `body` 15, `bodyBold` 15, `labelLg` 14, `label` 13, `eyebrow` 12 (uppercase, widened tracking), `caption` 12 and `captionSm` 11.
- **FR-007a**: Because the platform selects a bundled face by file name rather than by numeric weight, each weight MUST ship as its own font family, and **no numeric font weight may be set anywhere** — not in a text style, not as a styling class name, and not in navigation header options. Weight is carried by the family alone. A style that sets both a bundled family and a numeric weight of 700 or above silently renders in the system font, with no error at compile or build time.
- **FR-008**: The corner-radius scale MUST provide twelve steps: 3 (dietary glyph), 8, 10, 12, 14, 16, 18, 20, 22, 24, 28 and fully-rounded.
- **FR-009**: Tangerine MUST remain the only value a canteen can override for its own branded build. Every other foundation value MUST be fixed across all canteens.
- **FR-010**: A canteen brand colour MUST be evaluated against **exactly one pairing** — espresso text on the brand fill, ≥4.5:1. A failing colour warns and falls back to the default; it does not fail the build. The former brand-as-foreground leg is **removed**: requiring both legs is mathematically unsatisfiable (it demands a brand both light enough to carry espresso text and dark enough to read on cream), and the redesign never uses the brand colour as text.

**Shared components**

- **FR-011**: A primary action MUST render as a fully-rounded 52-unit-tall espresso button with light text.
- **FR-012**: A brand action MUST render as a fully-rounded 52-unit-tall brand-coloured button with espresso text.
- **FR-013**: An unavailable action MUST render as a fully-rounded 52-unit-tall dashed-outline button on a muted fill, distinguishable from an available one by outline style as well as colour.
- **FR-014**: The add-to-cart control MUST be a fully-rounded brand-coloured control with a plus mark; once an item is in the cart it MUST become a quantity stepper with decrease and increase controls.
- **FR-015**: Every interactive control MUST present a touch target of at least 44 units in both dimensions.
- **FR-016**: A text field MUST be 48 units tall with a 14-unit radius and a defined border; a read-only field MUST be visually distinct by border style and fill, not colour alone.
- **FR-017**: The pickup code MUST render as six individual digit cells on a dark panel, each cell brand-filled with the display typeface at large size.
- **FR-018**: A content card MUST render on a light fill with a 24-unit radius and a hairline border.

**Screens**

- **FR-019**: Each of the 26 screens with a supplied artboard MUST match that artboard's layout, hierarchy and component usage.
- **FR-020**: The menu MUST present dishes in a two-column grid.
- **FR-021**: A sold-out dish MUST carry an explicit sold-out stamp over its image and an unavailable add control.
- **FR-022**: The six screens without a supplied artboard — forgot-password request, forgot-password verify, change password, edit profile, app launch, and product create/edit — MUST be restyled using only the foundations and shared components defined above, with no new layout patterns invented.
- **FR-023**: The side menu MUST present the three role variants shown in the artboards, driven by the signed-in user's role exactly as it is today.

**Preservation**

- **FR-024**: No screen's fields, field order, labels, validation rules or error messages MUST change.
- **FR-025**: No navigation path, screen-to-screen transition or role-based routing rule MUST change.
- **FR-026**: No request the app makes, and no data it sends or expects, MUST change.
- **FR-027**: No business rule — ordering, payment, fulfilment, permissions — MUST change.
- **FR-028**: Every screen that exists today MUST still exist, and no new screen MUST be added.

### Key Entities

- **Design foundation set**: The single shared definition of colour, typography, spacing and radius that the entire app reads from. One per app; overridable by exactly one value (brand colour) per canteen.
- **Canteen brand override**: A canteen-supplied brand colour applied at build time, subject to a contrast gate.
- **Artboard**: One approved screen design. 27 exist; 26 map to an existing screen, 1 is the foundation reference.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A student sees at least **three times as many dishes** without scrolling as in the current single-column menu (six versus two on a typical screen).
- **SC-002**: **100% of the app's screens** render in the new design language — all 27 screen files plus the role-routed navigation shell, including the six screens with no supplied artboard.
- **SC-003**: **Zero behavioural differences** are observable between the current app and the refreshed app: every field, validation message, action outcome and navigation path is identical.
- **SC-004**: **Zero hardcoded design values** remain in screens or components for any property the foundations define, and **zero styling class names remain that the foundations no longer define** — a name that silently stops applying is as much a defect as a hardcoded value.
- **SC-005**: All body text meets a contrast ratio of **at least 4.5:1** against its background, and all large text at least **3:1**.
- **SC-006**: Every interactive control meets the **44-unit minimum touch target**.
- **SC-007**: A reviewer comparing each of the 26 designed screens against its artboard finds **no layout or hierarchy mismatch**.
- **SC-008**: A canteen brand colour that would render espresso text on it unreadable is rejected and replaced by the default, with a warning. At least one non-default brand colour is demonstrably **accepted**, proving the override path still works.
- **SC-009**: The sold-out state is correctly identified by **every participant** in an informal review, without prompting.

---

## Assumptions

- **The redesign canvas is the authority on appearance; the current app is the authority on behaviour.** Where an artboard appears to show different fields, copy or logic from the shipped screen, the shipped screen wins and the difference is recorded rather than implemented. The canvas's own foundation board states this intent.
- **The canvas's `OrderSuccess` artboard is a state, not a screen.** The app presents the paid-order confirmation inside the existing order detail screen; that artboard therefore specifies how that screen looks in its `order_placed` state. No new screen is created.
- **The canvas's three side-menu artboards are role variants of the one existing side menu**, not three separate menus.
- **Artboards are specified at a single phone size.** They are treated as proportional intent, to be realised responsively across supported devices rather than reproduced at fixed pixel sizes.
- **The existing brand-override and contrast-check mechanism is retained**, with the contrast gate **narrowed to a single pairing** — espresso text on the brand fill. Its former brand-as-foreground leg is removed, because the redesign never uses the brand colour as text: links use the dedicated link colour and controls use espresso. Keeping both legs was proven to reject every colour in the sRGB gamut.
- **Bundling the two typefaces requires a platform build change** and therefore a fresh install rather than a reload; this is accepted and is sequenced first so that a font problem cannot block screen work.
- **Android is the only target.** The project has no iOS build today, so iOS rendering is out of scope.
- **Updated brand artwork is out of scope for this feature.** The new icon, logo and white mark are committed to the repository but are not applied here; replacing the launcher icon is a platform-resource change no artboard covers, and is deferred.
- **No automated visual-regression tooling exists**, so artboard fidelity is verified by structured human review against each artboard rather than by snapshot tests.
- **Dark mode is not in scope.** The redesign defines a single light appearance.
- **The brand-override resolver is dormant.** It has no production call site — only its own test imports it, and no tenant brand configuration exists in the repository. This feature corrects the resolver's contrast logic; it does **not** wire it into the running app, which would be new non-visual behaviour. Acceptance scenarios about a tenant colour being applied are therefore verified as unit assertions, not on a device.
- **The Register artboard omits the required gender field.** The shipped app requires it; the artboard does not show it. Per the standing rule that the shipped app governs behaviour, the field is retained and styled to match the artboard's own segmented-chip pattern.
- **Reverting this feature after release requires a new application build**, because bundled font files are platform assets rather than part of the reloadable bundle. There is no partial rollback: the change ships, and is withdrawn, as one unit.
- **The application's styling is applied through utility class names, not only through the token module.** Changing or removing a class name that screens already use is therefore a breaking change even when nothing fails to compile.
