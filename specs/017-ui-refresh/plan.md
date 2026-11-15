# Implementation Plan: Mobile App UI Refresh

**Branch**: `017-ui-refresh` | **Date**: 2026-11-06 | **Revision**: 6 (re-planned against the re-specified spec) | **Spec**: [spec.md](./spec.md)

---

## Summary

Restyle the React Native Android app to the redesign canvas, changing appearance only. Work proceeds in the seven layers the spec prioritises: foundations, shared components, brand, then four screen groups. Because styling is applied through utility class names that screens already use, the foundation layer shifts the whole app's colour and type before a single screen is edited; the screen layers are then small, bounded edits.

**Revision 6 changes from revision 5** (which passed the review gate 3/3):
- Restructured from 11 work units to **8 phases matching the spec's P1–P7 plus a test phase**.
- **Brand assets are back in scope** as P3 (adaptive launcher icon + splash).
- **Tests move to the final phase** *(user instruction)*, reversing revision 5's early-gate authoring. Consequence recorded in Risks.
- Every artboard is mapped to its screen file, and every phase lists the files it touches.

---

## Mobile-only scope — verified

**No file in this plan lies under `api/` or `mobile/src/api/generated/`.**

| Path | Status |
|---|---|
| `api/**` | **Untouched.** Not opened by any phase. |
| `mobile/src/api/generated/**` | **Untouched.** 14 generated contract type files; regenerating or editing them is forbidden by FR-032. |
| `mobile/src/api/client.ts` | **Untouched.** Transport only; no styling. |
| `mobile/src/auth/**`, `mobile/src/cart/**`, `mobile/src/notifications/**` | **Untouched.** State and side effects, no styling. |
| `mobile/src/config/tenant.ts` | **Untouched.** |
| `mobile/src/theme/**`, `mobile/src/components/**`, `mobile/src/screens/**`, `mobile/src/navigation/**` | In scope. |
| `mobile/android/app/src/main/res/**`, `mobile/assets/**`, `mobile/tailwind.config.js`, `mobile/react-native.config.js`, `mobile/package.json` | In scope (fonts and brand only). |

---

## Technical Context

**Language/Version**: TypeScript 5.9, React 19.2
**Primary Dependencies**: React Native 0.86.3 (bare CLI — not Expo), NativeWind 4.2 / Tailwind 3.4, React Navigation 7
**New devDependency**: `react-native-asset` (pinned; invoked via an `npm run fonts:link` script, never `npx`)
**Storage**: N/A
**Testing**: Jest 29 + ts-jest, `mobile/test/`. **Mocked only** — no device, no network, no real native module.
**Target Platform**: Android only; no `mobile/ios/`
**Project Type**: Mobile presentation layer of a monorepo whose `api/` is untouched

**Constraints**
- Styling is applied through class names; changing or removing one is breaking even when nothing fails to compile
- No numeric font weight anywhere — style, class, or header option (FR-007a)
- `primary` is the only per-tenant override; the contrast gate warns and falls back, checking one pairing only (FR-010)
- No Expo package (`mobile/AGENTS.md`)
- Font bundling needs a native rebuild; **reverting also needs one** — no partial rollback
- Zero behavioural change (FR-030 … FR-035) and six explicit prohibitions (FR-036 … FR-041)

**Scale** — measured, not estimated:

| | Count |
|---|---|
| Screen files | **27** (student 9, shared 5, admin/staff 13) |
| Shared components | **14** |
| Navigation files | **9** (8 navigators + `navigationRef.ts`, which carries no styling) |
| Artboards | **27** (26 screen boards + 1 Foundations) |
| Typography class usages | **154** |
| Colour class usages | **126** foundation + **47** off-palette across 23 files |
| Radius class usages | **57** |
| `font-*` weight classes | **19** across 14 files |
| Inline `fontWeight` style props | **4** (+2 in `navigationHeader.ts`) |
| Raw literals | 7 hex, 7 `fontSize`, 1 `borderRadius` |
| Files importing `theme/tokens` | **13** (none import `typography` or `radius`) |

---

## Constitution Check

`.specify/memory/constitution.md` is an unfilled template; per `CLAUDE.md` the governing constraints are `docs/architecture/04-Architecture.md` and `docs/product/01-BRD.md`.

| Gate | Source | Status |
|---|---|---|
| Multi-tenant isolation never weakened | Architecture §6 | **PASS** — no query, claim, policy or API call touched |
| Tenant branding stays one codebase + build flavour | BRD Assumption 2 | **PASS** — `primary` still the sole override |
| `tokens.ts` single source of truth | Architecture §10.2 | **PASS, strengthened** — hand-duplication into `tailwind.config.js` removed |
| No Expo | `mobile/AGENTS.md` | **PASS** — `react-native-asset` is a bare-RN tool |
| FCM / Razorpay preserved | Architecture §8, §1 | **PASS** — not touched |
| Tests mocked, never real services | `CLAUDE.md` | **PASS** — explicitly mocked-only |
| **Implementation before tests** | `CLAUDE.md` | **PASS** — tests are the final phase, per user instruction. Revision 5's early-gate exception is withdrawn. |
| `/self-reflect` before PR | `CLAUDE.md` | Scheduled — P8 |
| 80% coverage gate | `.coverage-thresholds.json` | Exemption **accepted by the user** 2026-11-06 (API-only command) |

---

## Artboard → screen file map (all 27 boards)

**23 screen boards → 21 screen files** (two screens carry two boards each); **3 drawer boards → `AppShell.tsx`**; **1 Foundations board → the token module**.

| # | Artboard | Screen file | Phase |
|---|---|---|---|
| 1 | `Main` (Foundations) | `src/theme/*` — no screen | P1 |
| 2 | `Login` | `src/screens/student/LoginScreen.tsx` | P4 |
| 3 | `Register` | `src/screens/student/RegisterScreen.tsx` | P4 |
| 4 | `Home` | `src/screens/student/HomeScreen.tsx` | P5 |
| 5 | `Drawer` | `src/navigation/AppShell.tsx` *(student variant)* | P5 |
| 6 | `Cart` | `src/screens/student/CartScreen.tsx` | P5 |
| 7 | `OrderSuccess` | `src/screens/student/OrderDetailScreen.tsx` *(`order_placed` state)* | P5 |
| 8 | `OrderDetail` | `src/screens/student/OrderDetailScreen.tsx` *(`payment_failed` state)* | P5 |
| 9 | `MyOrders` | `src/screens/student/MyOrdersScreen.tsx` | P5 |
| 10 | `Profile` | `src/screens/shared/ProfileScreen.tsx` | P6 |
| 11 | `Feedback` | `src/screens/shared/FeedbackScreen.tsx` | P6 |
| 12 | `ContactUs` | `src/screens/shared/ContactUsScreen.tsx` | P6 |
| 13 | `Dashboard` | `src/screens/tenant-admin-staff/DashboardScreen.tsx` | P7 |
| 14 | `AdminProducts` | `src/screens/tenant-admin-staff/ProductListScreen.tsx` *(admin variant)* | P7 |
| 15 | `StaffProducts` | `src/screens/tenant-admin-staff/ProductListScreen.tsx` *(staff variant)* | P7 |
| 16 | `IncomingOrders` | `src/screens/tenant-admin-staff/IncomingOrdersScreen.tsx` | P7 |
| 17 | `Fulfilment` | `src/screens/tenant-admin-staff/OrderFulfilmentScreen.tsx` | P7 |
| 18 | `FeedbackReview` | `src/screens/tenant-admin-staff/FeedbackListScreen.tsx` | P7 |
| 19 | `FeedbackDetail` | `src/screens/tenant-admin-staff/FeedbackDetailScreen.tsx` | P7 |
| 20 | `Categories` | `src/screens/tenant-admin-staff/CategoryListScreen.tsx` | P7 |
| 21 | `CategoryForm` | `src/screens/tenant-admin-staff/CategoryCreateEditScreen.tsx` | P7 |
| 22 | `Departments` | `src/screens/tenant-admin-staff/DepartmentListScreen.tsx` | P7 |
| 23 | `DepartmentForm` | `src/screens/tenant-admin-staff/DepartmentCreateEditScreen.tsx` | P7 |
| 24 | `Users` | `src/screens/tenant-admin-staff/UserListScreen.tsx` | P7 |
| 25 | `UserForm` | `src/screens/tenant-admin-staff/UserCreateEditScreen.tsx` | P7 |
| 26 | `AdminDrawer` | `src/navigation/AppShell.tsx` *(company_admin variant)* | P7 |
| 27 | `StaffDrawer` | `src/navigation/AppShell.tsx` *(company_staff variant)* | P7 |

**The 6 screens with no artboard** (FR-029 — restyled from established patterns, no new layouts):

| Screen file | Phase | Pattern source |
|---|---|---|
| `src/screens/student/SplashScreen.tsx` | P3 | Brand mark on brand ground |
| `src/screens/student/ForgotPasswordRequestScreen.tsx` | P4 | `Login` — input + primary button |
| `src/screens/student/ForgotPasswordVerifyScreen.tsx` | P4 | `Fulfilment` — segmented code entry |
| `src/screens/shared/EditProfileScreen.tsx` | P6 | `Profile` + `UserForm` field patterns |
| `src/screens/shared/ChangePasswordScreen.tsx` | P6 | `Login` password-field pattern |
| `src/screens/tenant-admin-staff/ProductCreateEditScreen.tsx` | P7 | `UserForm` / `CategoryForm` |

27 screen files, each in exactly one phase: P3 (1) + P4 (4) + P5 (4) + P6 (5) + P7 (13) = **27**.

---

## Phases and the files each touches

### P1 — Foundations

Tokens, Tailwind config, fonts, status colours, navigation header.

| File | Action |
|---|---|
| `mobile/src/theme/tokens.raw.js` | **new** — plain CommonJS, single source of raw values |
| `mobile/src/theme/tokens.ts` | rewritten as a typed re-export; export shape preserved for the 13 importers |
| `mobile/src/theme/accents.ts` | **new** — the seven accent-pair families (FR-003a) |
| `mobile/src/theme/statusColors.ts` | rewritten on `accents.ts` (FR-004) |
| `mobile/src/theme/navigationHeader.ts` | two grounds + **remove `fontWeight: '700'` at :12,27** (FR-007a) |
| `mobile/src/theme/brand/contrastCheck.ts`, `resolveBrandTheme.ts` | single-pairing gate (FR-010); re-derive both test fixtures |
| `mobile/tailwind.config.js` | requires `tokens.raw.js`; class-compatibility map; single-utility text-style plugin |
| `mobile/react-native.config.js` | **new** — `assets: ['./assets/fonts']` |
| `mobile/package.json` | pin `react-native-asset`; add `fonts:link` script |
| `mobile/assets/fonts/*` | **new** — 5 static `.ttf` + OFL licence text |

**Font bundling**: `react-native.config.js` declares the asset directory; `npm run fonts:link` runs the pinned `react-native-asset`, copying faces into `android/app/src/main/assets/fonts/`. **Static instances only, one family per weight, no numeric weight anywhere** — the platform resolves by file name and collapses any weight ≥700 to a `_bold` suffix, so a bundled family plus a numeric weight silently renders in the system font.

**Verify before proceeding**: render one sample per face on a device. **Inter-Bold and BricolageGrotesque-ExtraBold are the meaningful checks** — the ≥700 faces are the ones that fail silently.

**Done when**: `npm run typecheck` passes with all 13 importers unedited; the app builds; every screen already shows the new ground, text colour and typefaces with no screen-level edit.

### P2 — Shared components *(all 14)*

| File | Notes |
|---|---|
| `PrimaryButton.tsx` | FR-012, FR-013 — outline style distinguishes disabled |
| `StatusBadge.tsx` | FR-004 — four pairs; `rounded-full` → `rounded-pill` |
| `ProductCard.tsx` | FR-026 — tinted placeholder, sold-out stamp, add → stepper |
| `CartSummaryBar.tsx` | `shadowColor: '#000'` → the `shadow` token |
| `PasswordInput.tsx`, `Dropdown.tsx` | FR-016, FR-020 — picker surface; `bg-black/40` → `scrim` |
| `CategoryChip.tsx`, `NavButton.tsx`, `RowActionButton.tsx`, `EmptyState.tsx`, `SkeletonCard.tsx` | foundation values only |
| `Screen.tsx` | gains a surface prop so screens declare their ground (FR-003) |
| `BrandRationaleSlider.tsx` | 3 raw hexes; rendered on Login |
| `PlatformScopeHeader.tsx` | dead code — **restyle, do not delete** (deleting a file is outside a visual refresh) |
| **new** OTP display + OTP entry | FR-017, FR-018 — six cells; entry clears on a wrong code |
| **new** switch row | FR-019 — the sold-out control |

Also in P2: delete the **12 `font-*` weight classes across 8 component files**; migrate component-level off-palette classes; raise every touch target to **44** even where an artboard shows 40 or 34×40 (FR-015).

### P3 — Brand

| File | Action |
|---|---|
| `mobile/android/app/src/main/res/mipmap-*/**` | adaptive launcher icon from `gf-icon-v2.png` (FR-022) |
| `mobile/android/app/src/main/res/values/ic_launcher_background.xml` | brand ground |
| `mobile/assets/brand/*` | already committed: `gf-icon-v2`, `gf-logo-v2`, `gf-mark-white` |
| `mobile/src/screens/student/SplashScreen.tsx` | new logo on a brand ground (FR-023) |

**Verify**: the icon renders correctly under round, squircle and square masking.

### P4 — Auth

`LoginScreen.tsx`, `RegisterScreen.tsx`, `ForgotPasswordRequestScreen.tsx`, `ForgotPasswordVerifyScreen.tsx`, `src/navigation/AuthNavigator.tsx`.

- **Register keeps its `gender` control** — the artboard omits it; the shipped app requires it (FR-030).
- `AuthNavigator.tsx:44` sets `headerStyle` inline. Route it through `navigationHeader.ts` as a **third, auth-specific option set preserving its current background and tint** — it is deliberate (commit `c2b7b0c`, *"match Login header to screen background, not brand orange"*) and must **not** point at the brand header.
- `ForgotPasswordVerify` uses P2's OTP entry component.

### P5 — Student

`HomeScreen.tsx`, `CartScreen.tsx`, `OrderDetailScreen.tsx` (both states), `MyOrdersScreen.tsx`, `src/navigation/AppShell.tsx` (student variant), `RootNavigator.tsx`, `StudentNavigator.tsx`.

- **`HomeScreen` is a structural change**: it is currently a `.map()` inside `Screen.tsx`'s `ScrollView`, so there is no virtualisation to preserve — the two-column grid *introduces* it. `<Screen scroll={false}>` + an owned list with two columns + a bottom inset, or `CartSummaryBar`'s absolute overlay permanently hides the last row. Empty and skeleton states move into the list. **There is no pull-to-refresh today** (`load()` runs once from `useEffect`), so none is preserved and none is added.
- **`AppShell` drawer content**: name + canteen only, **role removed** (FR-027). The role currently renders at `AppShell.tsx:65`.
- `OrderSuccess` is the `order_placed` state — full-bleed brand ground, six pickup cells. No new screen or route.
- `RootNavigator.tsx:18` hardcodes `bg-background` on its loading view — give it a declared surface.

### P6 — Shared screens

`ProfileScreen.tsx`, `EditProfileScreen.tsx`, `ChangePasswordScreen.tsx`, `ContactUsScreen.tsx`, `FeedbackScreen.tsx`, plus `ProfileNavigator.tsx`, `ContactUsNavigator.tsx`, `FeedbackNavigator.tsx`.

- **Contact details stay information** — no dialler, no mail client (FR-038). Today `ContactUsScreen.tsx:71,78` render them underlined in brand colour; migrate to the `link` token, which is a colour change only.
- `FeedbackScreen.tsx:167` holds a raw hex.
- These three navigators pass `primaryHeaderOptions` unconditionally and read no role, so an admin sees brand-orange chrome here. **Making them role-aware adds role branching to navigation files** — see Open Decisions.

### P7 — Admin & Staff

All 13 `tenant-admin-staff` screens, `src/navigation/AppShell.tsx` (admin + staff variants), `TenantAdminStaffNavigator.tsx`.

- Staff product list exposes **only** the sold-out switch (FR-036-adjacent: no create/edit/delete).
- Fulfilment never displays the code; it uses P2's OTP entry, clearing on mismatch (FR-018).
- User form role options exclude Company Admin; Category required for Student (FR-039, FR-040).
- Feedback resolve stays one-way (FR-041).
- Dashboard has **no open/closed toggle** (FR-036).
- The **4 inline `fontWeight: '700'` / `fontSize: 15`** props in the `headerRight` "+ Add" buttons live here (`CategoryListScreen:66`, `DepartmentListScreen:64`, `ProductListScreen:84`, `UserListScreen:57`).

### P8 — Tests and close-out *(all tests live here, per user instruction)*

Mocked only — no device, no network, no real native module.

| Spec | Asserts |
|---|---|
| `theme/tokens.spec` | `tokens.ts` deep-equals `tokens.raw.js` |
| `theme/contrast.spec` | 7 accent pairs ≥4.5:1; espresso-on-brand per swatch; a failing colour falls back **and a passing one is accepted** |
| `theme/fonts.spec` | every token's family is bundled; **no numeric weight anywhere in `src/`** — style prop, `font-*` class, or header option |
| `theme/classnames.spec` | no `text-*`/`bg-*`/`border-*`/`rounded-*`/`font-*` class missing from the generated theme, and none resolving to an off-palette value |
| `theme/token-discipline.spec` | no raw hex, radius or size literal in screens or components |
| `theme/brand.spec` | only `primary` differs across resolved themes |
| `theme/statusColors.spec` | unknown status → `neutral` + raw label; no screen imports `accents` directly |
| `theme/surface.spec` | every screen declares a ground; none hardcodes one |
| `theme/touch-targets.spec` | AST scan — every pressable ≥44 |

Then `/self-reflect`, knowledge-base commit, final cross-unit review, PR.

**Phase order**: P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8. P3 is independent of P2 and may run in parallel.

---

## Risks

| # | Risk | Likelihood | Mitigation |
|---|---|---|---|
| 1 | **Tests run last, so the two silent-failure gates detect damage rather than prevent it.** A dead class and a system-font fallback both leave `tsc` and the build green. | **Certain, by design** | *User instruction, aligned with `CLAUDE.md`.* Substitute: P1 ends with a per-face device check, and each screen phase ends with a manual artboard review. The cost is that a class broken in P1 may not be detected until P8. |
| 2 | Tailwind plugin does not emit single text-style utilities under NativeWind 4 | Medium | P1 spike; documented fallback is a paired-class convention, which expands P4–P7 by ~154 text nodes |
| 3 | Fonts resolve below weight 700 but not at/above it — the silent half-failure | High if unguarded | P1's per-face device check, with the two ≥700 faces as the meaningful test |
| 4 | `HomeScreen` list rewrite regresses the empty state or hides the last row | Medium | Named in P5; bottom inset and list-level empty/skeleton are explicit |
| 5 | Behavioural drift while restyling | Medium | Manual regression paths in `quickstart.md` + per-phase review |
| 6 | **No partial rollback** — fonts are platform assets, so reverting needs a new build | Certain | Land as one reviewable PR |
| 7 | `tokens.raw.js` literal widening breaks typecheck | Medium | JSDoc annotations mandated |

---

## Open Decisions

| # | Decision | Default if unanswered |
|---|---|---|
| 1 | **Role-aware headers** for Profile / Contact Us / Feedback. Adds role branching to three navigation files; the brief said no navigation changes. | **Not done.** Those screens keep brand-orange chrome for every role — visually inconsistent for an admin, behaviourally untouched, no gate affected. |
| 2 | **A React Native renderer** for structural before/after regression assertions. Not currently a dependency. | **Not added.** FR-030 … FR-035 rest on the manual regression paths and per-phase review. |

---

## Complexity Tracking

| Item | Why needed | Simpler alternative rejected because |
|---|---|---|
| `tokens.raw.js` layer | `tailwind.config.js` hand-copies every token; this feature would triple what is duplicated | Hand-syncing ~30 colours, 7 accent families, 12 radii and 15 text styles will drift; codegen adds build machinery a shared CommonJS file makes unnecessary |
| `react-native-asset` devDependency | Not installed; CLI 20 removed `link`; an unpinned `npx` in a build path is a supply-chain risk | Committing `.ttf` files directly into `android/app/src/main/assets/fonts/` is viable — chosen only if the pinned tool misbehaves |
| `HomeScreen` structurally rewritten in a visual-only feature | The two-column grid is unreachable from a `.map()` inside a `ScrollView`, and SC-001 is the feature's headline | `flex-wrap` on the existing map is purely visual but renders every product unvirtualised. **User chose the rewrite.** |
| Two new components (OTP entry, switch row) | FR-018 and FR-019 name behaviour no existing component provides | Inlining them per screen would violate FR-002 and duplicate the clear-on-error logic |

---

## Post-Design Constitution Re-check

No new violations. The design strengthens the single-source-of-truth constraint, leaves every multi-tenancy and auth boundary untouched, adds one pinned build-time dependency, and — unlike revision 5 — now complies with `CLAUDE.md`'s implementation-before-tests rule without needing an exception.
