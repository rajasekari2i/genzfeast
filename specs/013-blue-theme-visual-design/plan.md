# Implementation Plan: Blue Visual Design System (Zomato-Style Food App UI)

**Branch**: `013-blue-theme-visual-design` | **Date**: 2026-09-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-blue-theme-visual-design/spec.md`

## Summary

Define and implement one shared design-token system (blue-anchored palette, semantic order-status colors, typography/spacing scale) plus a set of reusable, Zomato-style UI components (image-forward product card, floating cart bar, category chips, status badges, primary buttons, empty/loading states) consumed by all three app surfaces already scaffolded in `mobile/`. Layer on top of it a build-time-only per-tenant brand override (accent color, logo, app name) with a WCAG AA contrast gate, matching the per-tenant branded-build capability already described in `docs/architecture/04-Architecture.md` §"Mobile builds." No backend/API/database changes — this is entirely a `mobile/` (React Native + NativeWind) concern.

## Technical Context

**Language/Version**: TypeScript (React Native / Expo), per `CLAUDE.md`'s decided mobile stack

**Primary Dependencies**: Existing `mobile/` scaffold — Expo SDK 57, NativeWind v4 (Tailwind preset), React Navigation native-stack. No new dependency is introduced by this feature.

**Storage**: N/A. Design tokens are static TypeScript/Tailwind config. The per-tenant brand override is a build-time config file (see Research §3), not a database table — it does not touch `specs/001-company-role-user-setup`'s already-committed `companies` schema.

**Testing**: Jest (already configured in `mobile/package.json`'s `typecheck` tooling) for unit-testing the contrast-ratio utility and token exports; manual visual verification via `npx expo start` across all three navigators (no visual-regression tool in the current stack, so this is explicitly a manual quickstart step, not an automated gate).

**Target Platform**: React Native (Android + iOS), Expo managed workflow — same target as the existing `mobile/` scaffold.

**Project Type**: Mobile app (single shared codebase, three navigator surfaces: Student, Tenant Admin & Staff, System Admin) — matches the structure already established in `mobile/src/navigation/`.

**Performance Goals**: No perceptible added startup cost from theme resolution (token/brand-config merge happens once at app load, not per-render); product list scrolling remains smooth with image-forward cards (no synchronous, blocking image decoding on the main thread).

**Constraints**: Per-tenant branding is resolved at **build time only** (per Architecture's existing "one CI pipeline per environment × per tenant flavor" model) — no runtime theme-switching or per-request theme fetch; all tenant-override colors must pass a WCAG 2.1 AA (4.5:1) contrast check before a build may ship with them (FR-012); no visual elements for out-of-scope V1 capabilities (ratings/reviews, delivery-address/map, loyalty) may be introduced (FR-013).

**Scale/Scope**: ~1 token set (~10-15 color tokens, ~7 typography styles, spacing/radius scale) and ~7 new shared components, applied across the already-scaffolded ~20 screens spanning 3 navigators in `mobile/src/screens/`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is an unfilled template. Per `CLAUDE.md`'s own stated fallback, `docs/architecture/04-Architecture.md` and `docs/product/01-BRD.md` govern this check instead.

| Gate | Result | Basis |
|---|---|---|
| No new/undecided technology introduced | PASS | Uses only the already-decided mobile stack (React Native, TypeScript, NativeWind) — CLAUDE.md "Tech Stack" table |
| Multi-tenant isolation not weakened | PASS | Feature touches no data layer; per-tenant branding is a single-tenant, build-time artifact (one build = one company), so there is no runtime cross-tenant theme-leak vector |
| Per-tenant branded-build capability respected, not duplicated | PASS | Reuses the existing build-time, per-`TENANT_ID`/`company_id` CI parameterization already described in Architecture §"Mobile builds," rather than inventing a second, runtime mechanism |
| V1 scope boundaries respected | PASS | FR-013 explicitly excludes ratings/reviews, delivery-address/map, and loyalty visual elements, matching CLAUDE.md's "Out of scope for V1" list |
| No new backend/API/DB surface | PASS | Confirmed N/A in Technical Context — Storage; `specs/001`'s already-reviewed-and-committed migration is untouched |

No violations. Complexity Tracking is not needed.

**Post-Phase-1 re-check**: `data-model.md` and `contracts/` confirm the Tenant Brand Theme stays a build-time-only artifact (not a `companies` table column) and that `order_placed`'s status color is fixed platform-wide even in a branded build — both reinforce, rather than weaken, the gates above. No new violations introduced by the design phase.

## Project Structure

### Documentation (this feature)

```text
specs/013-blue-theme-visual-design/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
mobile/
├── tailwind.config.js                 # EXTEND: theme.extend.colors/fontSize/spacing from the token contract
├── src/
│   ├── theme/
│   │   ├── tokens.ts                  # NEW: Design Token Set — colors, typography scale, spacing/radius scale (contracts/design-tokens.md)
│   │   ├── statusColors.ts            # NEW: order-status → {color, label} map (FR-002/FR-003), consumed by Student + Staff + Admin order views
│   │   └── brand/
│   │       ├── resolveBrandTheme.ts   # NEW: merges tokens.ts defaults with an optional per-tenant brand config at build time
│   │       └── contrastCheck.ts       # NEW: WCAG 2.1 AA contrast-ratio utility (FR-012), used by resolveBrandTheme and unit-tested directly
│   ├── components/
│   │   ├── ProductCard.tsx            # NEW: image-forward card (FR-005)
│   │   ├── CartSummaryBar.tsx         # NEW: persistent floating cart bar (FR-006)
│   │   ├── CategoryChip.tsx           # NEW: filter chip/pill (FR-007)
│   │   ├── StatusBadge.tsx            # NEW: color+label order-status badge (FR-002/FR-003), reused by Student + Staff + Admin screens
│   │   ├── PrimaryButton.tsx          # NEW: shared high-contrast CTA button (FR-008)
│   │   ├── EmptyState.tsx             # NEW: themed empty-state (FR-009)
│   │   ├── SkeletonCard.tsx           # NEW: loading placeholder for image-heavy lists (FR-009)
│   │   └── PlatformScopeHeader.tsx    # NEW: System Admin Portal's distinct "platform-wide" header treatment (FR-010)
│   └── screens/                       # EXISTING (from the mobile scaffold) — updated to consume the components/tokens above instead of the current placeholder styling
└── test/
    └── theme/
        ├── contrastCheck.spec.ts      # NEW: unit tests for the contrast-ratio utility (passing + failing cases)
        └── resolveBrandTheme.spec.ts  # NEW: unit tests for default-vs-override merge and the AA fallback path
```

**Structure Decision**: This feature lives entirely inside the existing `mobile/` Expo project — no `backend`/`api` changes, no new top-level project. It adds one new `src/theme/` module (tokens + brand resolution) and a handful of new shared `src/components/`, then updates the already-scaffolded screens under `src/screens/` to consume them. This mirrors the single-shared-codebase, three-navigator structure `mobile/` already has (see `src/navigation/{Student,TenantAdminStaff,SystemAdmin}Navigator.tsx`).

## Complexity Tracking

*No Constitution Check violations — this section is not needed.*
