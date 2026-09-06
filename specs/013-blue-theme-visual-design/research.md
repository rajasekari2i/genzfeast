# Research: Blue Visual Design System (Zomato-Style Food App UI)

All Technical Context fields in `plan.md` were resolved with informed defaults (no `NEEDS CLARIFICATION` markers remain in the spec or plan). This document records the reasoning behind each non-obvious decision.

## 1. Where design tokens live: NativeWind Tailwind config vs. a standalone TS module

**Decision**: Define tokens in a standalone `mobile/src/theme/tokens.ts` (plain TypeScript objects/consts), and additionally mirror the color values into `mobile/tailwind.config.js`'s `theme.extend.colors` so `className="bg-primary"`-style NativeWind usage works.

**Rationale**: NativeWind's Tailwind config alone cannot express non-color tokens cleanly for React Native consumption in JS logic (e.g., `StatusBadge` needs to look up a status's color object at runtime from `orderStatus`, not just apply a static className). A single TypeScript source of truth (`tokens.ts`) that both feeds the Tailwind config *and* is importable directly in component logic avoids drift between "the color used in a className" and "the color used in a computed style," which would otherwise silently violate spec's FR-001/FR-002 (one consistent palette).

**Alternatives considered**:
- *Tailwind config only, read back via NativeWind's `useColorScheme`/theme APIs*: rejected — NativeWind v4 doesn't provide a first-class "give me the resolved value of token X in JS" API stable enough to depend on for logic like status-color lookup; would require fragile parsing of the Tailwind config object directly.
- *A React Context `ThemeProvider` supplying tokens at runtime*: rejected as unnecessary — since tenant branding is resolved at **build time** (see §3 below), there's no runtime scenario where the token set changes during a running app session that would justify a Context/provider's re-render capability. A plain imported constant is simpler and sufficient (YAGNI).

## 2. WCAG contrast-ratio calculation

**Decision**: Implement the standard WCAG 2.1 relative-luminance + contrast-ratio formula directly in `contrastCheck.ts` (~20 lines: sRGB → linear RGB → relative luminance → ratio), with no new npm dependency.

**Rationale**: The formula is small, stable (a W3C spec, not something that needs library maintenance/updates), and used in exactly one place (the build-time brand-override gate in `resolveBrandTheme.ts`) plus its own unit tests. Adding a dependency for a ~20-line, well-specified, rarely-changing algorithm is unjustified.

**Alternatives considered**:
- *`wcag-contrast` or similar npm package*: rejected — avoids an external dependency for something this small and stable; also keeps the mobile app's dependency footprint aligned with "no new dependency introduced by this feature" in Technical Context.

## 3. Per-tenant brand override mechanism (build-time vs. runtime)

**Decision**: A per-tenant brand override is a small JSON config file (shape defined in `contracts/tenant-brand-config.schema.json`) supplied at build time, consumed by `resolveBrandTheme.ts` during the app's build/bundling step (not fetched from an API at runtime).

**Rationale**: `docs/architecture/04-Architecture.md`'s existing "Mobile builds" note already establishes that per-tenant branded builds are produced by "one CI pipeline per environment × per tenant flavor, parameterized by `TENANT_ID`/`company_id` and branding assets" — i.e., branding is already an established **build-time** concern, one build per tenant, not a single build that fetches tenant config at runtime. This feature's job is to define *what* that branding config can contain (only accent color, logo, app name — FR-011) and *gate* it (contrast check — FR-012), not to invent a new delivery mechanism alongside the one Architecture already specifies.

**Alternatives considered**:
- *Runtime fetch of brand config from the API by `company_id` after login*: rejected — contradicts the existing Architecture decision (one build per tenant, not one universal build with server-driven theming), and would require new backend endpoints this spec's scope explicitly excludes ("No backend/API/database changes" — plan.md Summary).
- *Storing brand override as new columns on the `companies` table (specs/001)*: rejected for this feature's scope — `specs/001-company-role-user-setup`'s schema/migration already passed 5 rounds of adversarial review and is committed; reopening it for a UI-only concern that Architecture already treats as a build-time/CI parameter is unnecessary scope creep. If a future feature needs branding data queryable at runtime (e.g., a System Admin UI to edit a tenant's brand color), that is a natural follow-up feature, not part of this one.

## 4. Conveying order status without relying on color alone

**Decision**: Every `StatusBadge` renders a color **and** a text label (spec FR-003), sourced from one shared `statusColors.ts` map keyed by order status.

**Rationale**: Text labels are simple, already required by every screen spec in `docs/ui-screen/06-UI-Design.md` (status badges are always described with their status name), and fully solve the colorblind-accessibility edge case without adding a second visual system (e.g., icons/shapes per status) that the UI Design doc doesn't otherwise call for.

**Alternatives considered**:
- *Color + distinct icon per status (e.g., a clock for pending, a checkmark for delivered)*: considered as a stronger accessibility signal, but not adopted as a *requirement* — it would be a reasonable optional enhancement left to component implementation, not something this spec's FRs mandate, to avoid over-specifying visual details beyond what `docs/ui-screen/06-UI-Design.md` and the BRD/PRD call for.

## 5. Loading-state implementation for image-heavy lists

**Decision**: A lightweight custom `SkeletonCard` component (an animated `Animated.View` opacity pulse using React Native's built-in `Animated` API), no new dependency.

**Rationale**: React Native's built-in `Animated` API is sufficient for a simple pulse/shimmer skeleton; consistent with §2's principle of not adding dependencies for small, well-understood UI primitives.

**Alternatives considered**:
- *A skeleton-loading library (e.g., `react-native-skeleton-placeholder`)*: rejected — unnecessary dependency for a simple, one-component need; also such libraries commonly depend on `react-native-reanimated`, which earlier work in this project (`mobile/babel.config.js`) already had to work around a fragile peer-dependency chain for (`react-native-worklets`) — avoiding a second dependency on that chain reduces risk.
