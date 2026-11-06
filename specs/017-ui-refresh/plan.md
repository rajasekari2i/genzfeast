# Implementation Plan: Mobile App UI Refresh

**Branch**: `017-ui-refresh` | **Date**: 2026-11-06 | **Revision**: 4 (post review round 4 — PASSED 3/3) | **Spec**: [spec.md](./spec.md)

---

## Summary

Restyle the React Native app to the approved redesign canvas, changing appearance only. The work is a **class-layer-first** cascade: remap the utility classes screens already use, bundle five font faces, rebuild the shared components, then apply the result screen by screen.

**Revision 2 exists because revision 1 failed its review gate on all three dimensions, with 11 blockers.** The three that reshaped this plan:

- **The font mechanism was wrong.** Android resolves bundled fonts by *file name*, not PostScript name, and collapses any weight ≥700 to a `_bold` suffix. Every Bricolage heading would have silently rendered in the system font. Fixed by Option B: weight lives in the family name, and **no style sets a numeric weight** (research R7).
- **The plan targeted the wrong surface.** The app styles through ~355 utility class usages, not the 13 TS importers — and none of those import `typography` or `radius`. Deleting a class key would silently unstyle screens with no compile or build error (research R11).
- **`HomeScreen` has no virtualisation to preserve.** It is a `.map()` inside a `ScrollView`. The two-column grid *introduces* virtualisation — a structural change, accepted by the user (research R12).

All eight `spec.md` corrections are **already applied**, so `/speckit-tasks` will generate from corrected requirements.

---

## Technical Context

**Language/Version**: TypeScript 5.9, React 19.2
**Primary Dependencies**: React Native 0.86.3 (bare CLI — not Expo), NativeWind 4.2 / Tailwind 3.4, React Navigation 7
**New devDependencies** (3): `react-native-asset` — **accepted** (decision 6), invoked via `npm run fonts:link`, never `npx`; `@testing-library/react-native@^14` + `test-renderer@^1` — **pending confirmation**, required by decision 6's structural regression checks (WU0/WU9 — it is not currently installed and `@react-native-community/cli@20` no longer provides `link`)
**Storage**: N/A
**Testing**: Jest 29 + ts-jest (`mobile/test/theme/`, which already exists with 3 specs)
**Target Platform**: Android only — no `mobile/ios/`
**Project Type**: Mobile app; `api/` untouched

**Constraints**
- Styling is applied through class names; changing or removing one is breaking even when nothing fails to compile
- No typography style may set a numeric font weight (FR-007a)
- `primary` remains the only per-tenant override; the contrast gate warns and falls back, it does not fail the build
- No Expo package (`mobile/AGENTS.md`)
- Font bundling needs a native rebuild; **reverting this feature also needs one** — there is no partial rollback
- Zero behavioural change (FR-024 … FR-028)

**Scale** — measured, not estimated:

| | Count |
|---|---|
| Screen files (`src/screens/**/*.tsx`) | **27** |
| Shared components | **14** |
| Files in `src/navigation` | **9** (8 navigators + `navigationRef.ts`); **7** set header style, `RootNavigator` carries a ground class |
| Files importing `theme/tokens` | **13** (11 in `src/`, 2 tests) + 3 within `src/theme`. None import `typography`/`radius` |
| Typography class usages | **154** (5+12+66+18+7+36+10). The 172 figure in revision 2 double-counted the 18 `text-body-bold` inside `text-body`'s 84 matches |
| Colour class usages | **126** foundation + **47** off-palette across 23 files (`text-red-600` ×29; plus `Dropdown.tsx:48` `bg-black/40`) |
| Radius class usages | **57** |
| Raw literals | **7** hex (6 components incl. `CartSummaryBar:30` `#000`, 1 in `FeedbackScreen.tsx:167`) **+ 4 inline `fontWeight` + 7 inline `fontSize` + 1 `borderRadius`** — the full O1 census, not hex alone |
| Artboards | 27 |

---

## Constitution Check

`.specify/memory/constitution.md` is an unfilled template; per `CLAUDE.md` the governing constraints are `docs/architecture/04-Architecture.md` and `docs/product/01-BRD.md`.

| Gate | Source | Status |
|---|---|---|
| Multi-tenant isolation never weakened | Architecture §6 | **PASS** — no query, claim, policy or API call touched |
| Tenant branding stays one codebase + build flavour | BRD Assumption 2 | **PASS** — `primary` still the sole override |
| `tokens.ts` single source of truth | Architecture §10.2 | **PASS, strengthened** — hand-duplication into `tailwind.config.js` removed |
| No Expo | `mobile/AGENTS.md` | **PASS** — `react-native-asset` is a bare-RN tool |
| FCM / Razorpay preserved | Architecture §8, §1 | **PASS** |
| Tests never hit the real DB | `CLAUDE.md` | **PASS** — no DB |
| Implementation before tests | `CLAUDE.md` | **Honoured with one exception** — see Complexity Tracking |
| `/self-reflect` before PR | `CLAUDE.md` | **Scheduled** — WU10 |
| 80% coverage gate | `.coverage-thresholds.json` | ⚠️ **See Complexity Tracking** |

---

## Project Structure

```text
mobile/
├── react-native.config.js          NEW — declares assets/fonts
├── package.json                    MODIFIED — pin react-native-asset + fonts:link script
├── tailwind.config.js              REWRITTEN — requires tokens.raw.js; class layer; text-style plugin
├── assets/fonts/                   NEW — 5 static .ttf + OFL licence text
├── android/app/src/main/assets/fonts/   GENERATED
├── src/theme/
│   ├── tokens.raw.js               NEW — single source
│   ├── tokens.ts                   REWRITTEN — typed re-export (JSDoc-annotated source)
│   ├── accents.ts                  NEW
│   ├── statusColors.ts             REWRITTEN
│   ├── navigationHeader.ts         MODIFIED — role-aware header options
│   └── brand/{resolveBrandTheme,contrastCheck}.ts   MODIFIED — single-leg gate
├── src/components/                 all 14 restyled
├── src/screens/                    all 27 restyled
├── src/navigation/                 all 7 navigators
├── test/theme/                     EXTENDED — 11 gates in 9 spec files (3 already exist)
└── test/screens/                    NEW — WU0 baseline fixtures + RN jest project

api/                                UNTOUCHED
```

---

## Work units

### WU0 — Behavioural baseline *(first; no app code changes)*

Capture, for every form-bearing screen, its field set, labels, validation messages and action list **as they are today**, committed as fixtures.

- **Why first**: WU9 asserts before-vs-after equality. Revision 2 scheduled it after WU8, by which point the "before" state no longer existed — it would have silently degraded to an after-only snapshot that proves nothing.
- **Tooling**: this needs a React Native renderer, which the project does not have. Pin **`@testing-library/react-native@^14`** and **`test-renderer@^1`** — RTL-RN 14 dropped `react-test-renderer` for the separate `test-renderer` package, and the 12.x line that still peers on `react-test-renderer` predates this repo's React 19.2 / RN 0.86. Add an RN jest project alongside the existing `theme` project.
- **The mock layer is the hard part, not the two installs.** `jest.config.js` is today a single `ts-jest`/`node` project. The RN project needs: the RN jest preset plus `transformIgnorePatterns` covering `nativewind/babel`, `react-native-worklets/plugin` and Reanimated 4 (`babel.config.js:4-10`); and manual mocks for the native modules these screens import at module scope — `react-native-razorpay` (`CartScreen.tsx:4`), `react-native-image-picker` (`ProductCreateEditScreen.tsx:3`), `react-native-keychain` and `react-native-config` (via `src/api/client`, `src/config/tenant`), `@react-native-firebase/messaging` and `@notifee/react-native` (via `AuthContext` → `notifications/registerDevice`), plus navigation props and `useCart`.
- **Validation messages cannot be captured by a plain render.** `LoginScreen.tsx:89` renders its error only after a failed submit, so a bare render records "no validation messages" and WU9 would then assert nothing — the same looks-green-asserts-nothing failure this unit exists to prevent. Either drive a failed submit per form, or **scope the fixture to field set + labels + actions** and say so in the DoD.
- **Scope**: the 13 screens with forms (Login, Register, ForgotPasswordRequest/Verify, ChangePassword, EditProfile, CategoryForm, DepartmentForm, UserForm, ProductCreateEdit, Feedback, Fulfilment, Cart).
- **DoD**: the RN jest project runs green; a committed fixture per form screen capturing **field set, labels and actions** (validation messages only where a failed submit is driven); a trivially-passing equality test proving the harness works before anything changes.
- **Blocks**: WU9 only — WU1/WU2 may proceed in parallel.
- **If the renderer is not confirmed**: WU0 and WU9 are both dropped, and FR-024…FR-028 fall back to `quickstart.md`'s 6 manual regression paths plus per-unit review. Nothing else depends on them — a clean removal, not a redesign.

### WU1 — Fonts *(native; verify on device before any screen work)*

Pin `react-native-asset`; add `react-native.config.js`; add five `.ttf` faces plus OFL licence text; run the link step; rebuild.

- **Files**: `package.json`, `react-native.config.js`, `assets/fonts/*`
- **DoD**: a throwaway screen renders **one sample per face**, and each visibly differs. The **Inter-Bold and BricolageGrotesque-ExtraBold samples are the meaningful check** — those are the faces that fail silently if the convention is wrong. Confirm no sample sets `fontWeight`.
- **Why first**: the only native change, and the one whose failure mode is invisible.

### WU2 — Token foundation + class layer + the gates that catch silent failure

Create `tokens.raw.js` (JSDoc-annotated to survive literal widening); rewrite `tokens.ts`; add `accents.ts`; rewrite `statusColors.ts`; rewrite `tailwind.config.js` with the class-compatibility map (§1.1 of data-model) and the single-utility text-style plugin; **reduce the contrast gate to its single fill leg** (espresso-on-brand) and delete the brand-as-foreground leg.

- **Spike, resolved inside this unit**: prove the Tailwind plugin emits family + size + line-height as one utility under NativeWind 4. If it does not, fall back to the paired-class convention and **re-scope WU4–WU8 to add a family class to ~154 text nodes** before proceeding.
- **Tests authored here** (exception to implementation-before-tests, justified below): **G7 class-name resolution**, G3 font/no-weight, G2 contrast, G5 deep-equal, G1, G4, G6, O1.
- **Brand fixtures must swap roles**: `resolveBrandTheme.spec.ts:19` uses `#004D40` as the *passing* case (1.66 espresso-on-fill — now fails) and `:45` uses `#FFF9C4` as the *failing* case (15.19 — now passes). Under the single-leg gate both assertions invert. Re-derive: `#FFB020` (8.90) passes, `#E4572E` (4.42) fails.
- **DoD**: `npm run typecheck` passes; **`theme/classnames.spec` passes**, proving no screen references a class the theme no longer defines; the app builds and every screen already shifts to the new palette with no per-screen edits.
- **Blocks**: WU3–WU8.

### WU3 — Shared components *(all 14)*

`ProductCard`, `PrimaryButton`, `StatusBadge`, `PasswordInput`, `Dropdown`, `EmptyState`, `CartSummaryBar`, `CategoryChip`, `NavButton`, `RowActionButton`, `Screen`, `SkeletonCard`, **`BrandRationaleSlider`** (3 raw hexes; rendered on Login), **`PlatformScopeHeader`** (dead code — delete or restyle, decide and record).

- `Screen.tsx` gains a surface prop so screens declare `background` vs `backgroundAlt` (O2) instead of it hardcoding `bg-background`.
- **Tests here**: O2 surface, O3 status routing, O4 touch targets.
- **Also in this unit**: delete the `font-bold`/`font-semibold` classes in the **12 component sites across 8 files** (`CartSummaryBar:37,40`, `CategoryChip:24`, `PasswordInput:37`, `PlatformScopeHeader:14`, `PrimaryButton:48`, `ProductCard:39,59,61,68`, `RowActionButton:45`, `StatusBadge:20`); migrate the component-level off-palette classes (`RowActionButton` red, `StatusBadge`, `CategoryChip`); migrate `StatusBadge.tsx:19` `rounded-full` → `rounded-pill`; migrate `Dropdown.tsx:48` `bg-black/40` → the new `scrim` token and `CartSummaryBar.tsx:30` `shadowColor` → the `shadow` token; migrate the brand-as-foreground sites in `PasswordInput.tsx:37` and `RowActionButton.tsx:45`.
- **`PlatformScopeHeader` decision**: it is dead code (no importer outside itself). **Leave it in place and restyle it** — deleting a file is outside a visual refresh, and leaving it unstyled would fail G7/O1.
- **DoD**: every component matches data-model §6; **all touch targets ≥44** (the artboards' 40 and 34×40 are raised); the **5 component-level** raw hex literals are gone (the 6th, `FeedbackScreen.tsx:167`, belongs to WU4); O4 passes.

### WU4 — Student journey *(US2)* — 9 screens

Login, Register, Home, Cart, MyOrders, OrderDetail (`payment_failed`), Profile, Feedback, ContactUs.

- **HomeScreen is a structural change** (R12): `<Screen scroll={false}>` + owned `FlatList numColumns={2}` + `columnWrapperStyle` + bottom inset so `CartSummaryBar`'s absolute overlay stops hiding the last row. Empty/skeleton states move to `ListEmptyComponent`/`ListHeaderComponent`; pull-to-refresh re-verified.
- **Register keeps its `gender` control** — the artboard omits it (R6).
- Migrate the brand-as-foreground sites in this unit's files (`ContactUsScreen:71,78`, `CartScreen:153,157`, `OrderDetailScreen:154`) to `link`/`espresso` (R8).
- **Also in this unit**: the `FeedbackScreen.tsx:167` hex literal; this unit's `font-*` and off-palette classes (incl. `LoginScreen` `text-slate-500`, every form's `text-red-600`).
- **DoD**: each screen matches its artboard; regression paths 1–2 pass; gates green **for this unit's files**.

### WU5 — OrderSuccess full-bleed state

The `order_placed` state of `OrderDetailScreen`: full-bleed brand ground, six pickup digits at display size.

- Serialised after WU4 (same file).
- **DoD**: renders correctly for all three passing swatches; the pickup code remains re-readable until delivery; no route or state added.

### WU6 — Back-of-house *(US3)* — 12 screen files, 13 artboards

Dashboard, AdminProducts, StaffProducts, Categories, CategoryForm, Departments, DepartmentForm, Users, UserForm, IncomingOrders, Fulfilment, FeedbackReview, FeedbackDetail — all on `backgroundAlt` with navy chrome.

- **Also in this unit**: this unit's `font-*` and off-palette classes (`FeedbackDetailScreen` amber/green tints → `accents.sun`/`accents.mint`); `DashboardScreen.tsx:91` `rounded-full` → `rounded-pill`; and the **four inline `fontWeight: '700'` / `fontSize: 15` style props** in the `headerRight` "+ Add" buttons (`CategoryListScreen:66`, `DepartmentListScreen:64`, `ProductListScreen:84`, `UserListScreen:57`) — a third numeric-weight surface that neither classes nor tokens cover.
- **DoD**: each of the 13 artboards is matched (`AdminProducts` and `StaffProducts` are both `ProductListScreen.tsx`); every screen declares `backgroundAlt` (O2 passes); the staff product list exposes **only** the sold-out toggle; the fulfilment screen never renders the pickup code; `FeedbackListScreen:132` brand-as-foreground migrated; regression paths 4–6 pass.

### WU7 — Navigation chrome *(8 navigator files + `navigationHeader.ts`)*

Split in two: **7a is required and must precede WU4–WU8**; **7b is optional and blocks nothing.**

**WU7a — required.** Covers `navigationHeader.ts`, `AppShell`, `RootNavigator` and `AuthNavigator`:

- **Remove `fontWeight: '700'` from `navigationHeader.ts:12,27`** as the bundled family is added. Without this, every stack header title in the app renders in the system face (R7) — this is why 7a precedes the screen units.
- Restyle `AppShell`'s three role drawer variants.
- `RootNavigator`'s loading view hardcodes `bg-background` (an O2 violation site that had no owner before revision 4) — give it a declared surface.
- `AuthNavigator.tsx:44` sets `headerStyle` inline, bypassing `navigationHeader.ts`. Route it through as a **third, auth-specific option set that preserves its current background and tint**. It is deliberate — commit `c2b7b0c`, *"match Login header to screen background, not brand orange"* — and must **not** be pointed at `primaryHeaderOptions`, which would regress that fix.
- `StudentNavigator` and `TenantAdminStaffNavigator` need no per-file work: they only pass the shared option sets, so fixing `navigationHeader.ts` covers them.

**WU7b — ⚠️ pending acceptance.** Making `ProfileNavigator`, `ContactUsNavigator` and `FeedbackNavigator` choose header options by role introduces **new role-conditional logic into navigation files**; all three currently pass `primaryHeaderOptions` unconditionally and read no role. The outcome is visual, but the brief said "no navigation changes". *(Rationale: without it a Company Admin sees a brand-orange header on Profile, Contact Us and Feedback inside an otherwise navy app.)* **If declined**, those screens keep brand-orange chrome for every role — visually inconsistent for an admin, behaviourally untouched, and no gate is stranded: none of the three files contains a class name, literal or `fontWeight`.

- **WU7a DoD**: each role's menu items are byte-identical to before; no `fontWeight` remains anywhere in `src/theme/`; `RootNavigator` declares a surface; the Login header still matches its screen background; only presentation differs.
- **WU7b DoD** *(only if accepted)*: a shared screen opened by a Company Admin shows back-of-house chrome.

### WU8 — The six undesigned screens *(US4)*

Splash, ForgotPasswordRequest, ForgotPasswordVerify, ChangePassword, EditProfile, ProductCreateEdit — composed **only** from WU2/WU3 primitives.

- `PasswordInput:37` and `RowActionButton:45` brand-as-foreground migrated here if not already.
- **Also in this unit**: WU8's own `font-*` and off-palette classes (`ProductCreateEditScreen:219,249` and the four palette classes in its six files).
- **DoD**: no new layout pattern; no screen retains the old treatment; O1/G7/G3/O2 green **for this unit's six files**. The whole-tree assertion moves to WU10 (close-out) — the "last of WU4–WU8" owner named in contracts §5.

### WU9 — Structural regression checks

Re-render each form screen and assert its field set, labels, validation messages and action list are **equal to the WU0 baseline fixtures**. Covers FR-024 … FR-028, which otherwise rests only on 6 manual paths.

- **Why its own unit**: the user asked for it specifically, and it is the only automated evidence for "zero behavioural change". It depends on WU0 having captured the baseline first.
- **DoD**: every form screen has a before/after structural assertion; all pass.

### WU10 — Close-out

`/self-reflect`, commit knowledge-base updates, final cross-unit review, PR.

- **Why**: `CLAUDE.md` makes `/self-reflect` mandatory before PR creation; revision 1 omitted it.

### Dependency graph

```
WU0 (baseline) ──────────────────────────────────┐
WU1 (fonts) ─→ WU2 (tokens+classes) ─→ WU3 ─→ WU7a ─┬→ WU4 ─→ WU5
                                                      ├→ WU6
                                                      ├→ WU8
                                                      └→ WU7b (optional)
                                                   ↓
                                            WU9 ─→ WU10
```
WU0 and WU1 are independent and may run in parallel. **WU7a precedes WU4–WU8**: it removes the `fontWeight` governing every screen's header title and restyles the drawer, so no story can satisfy its own "matches its artboard" test without it. WU7b is optional and blocks nothing.

**Story independence**: gates **report** per-unit on that unit's files from the moment they are authored, and become **blocking** at their enforced-from unit (contracts §5), so WU4 (US2) can be declared done and demoed without waiting for WU6 or WU8. Brand artwork is **out of scope** (user decision), removing revision 1's unlinked WU9.

---

## Risks

| # | Risk | Likelihood | Mitigation |
|---|---|---|---|
| 1 | Tailwind plugin does not emit single text-style utilities under NativeWind 4 | Medium | WU2 spike resolves it before WU3; documented fallback re-scopes WU4–WU8 |
| 2 | Font faces resolve for weights <700 but not ≥700 (the silent half-failure) | **High if unguarded** | WU1 samples every face; G3 asserts no token carries a weight |
| 3 | A class silently stops applying | **High if unguarded** | G7 runs in WU2, the earliest possible point |
| 4 | `HomeScreen` FlatList rewrite regresses refresh / empty state / last-row visibility | Medium | Named DoD items in WU4; regression path 2 |
| 5 | Behavioural drift while restyling | Medium | WU9 structural assertions + 6 manual paths + per-unit review |
| 6 | `tokens.raw.js` literal widening breaks typecheck | Medium | JSDoc annotations mandated in data-model §1.2 |
| 7 | Mobile has no coverage gate | Certain | See Complexity Tracking |
| 8 | **No partial rollback** — reverting needs a native rebuild and store release | Certain | Land as one reviewable PR; stage via the existing per-tenant build flavours if a canary is wanted |

---

## Complexity Tracking

| Item | Why needed | Simpler alternative rejected because |
|---|---|---|
| **The 80% coverage gate does not apply** *(note: WU0 stands up the RN test infrastructure this row once called "a separate feature" — the exemption stands on scope, not on infrastructure being unavailable)*. `.coverage-thresholds.json` enforces `npm --prefix api run test -- --coverage` — API-only. | Pre-existing tooling gap. **ACCEPTED BY THE USER, 2026-11-06**, on the stated understanding that visual fidelity to the artboards rests on structured human review, since no snapshot tooling exists. | Extending it to `mobile/` means standing up RN component-test infrastructure — a separate feature. WU2/WU3's eleven gates plus WU9's structural assertions are the proportionate substitute. |
| **Tests authored in WU2/WU3, not after. ACCEPTED BY THE USER, 2026-11-06.** | G7 and G3 detect *silent* failures — an unknown class and a wrong font face both leave `tsc` and the build green. A gate that runs after 8 work units cannot prevent what it is for. | `CLAUDE.md` says implementation before tests. Revision 2 self-granted this waiver while correctly *asking* about the coverage exemption — the same rule, two standards. Revision 3 put it to the user, who accepted: the class-name and font gates catch failures that leave `tsc` and the build green, so a gate running after eight units cannot prevent what it exists for. Only the foundation gates move early. |
| **`tokens.raw.js` layer added.** | `tailwind.config.js` hand-copies every token; this feature would triple what is duplicated. | Hand-syncing ~30 colours, 7 accent triplets, 12 radii and 15 text styles will drift; codegen adds build machinery a shared CommonJS file makes unnecessary. |
| **Two new devDependencies**: `react-native-asset` (fonts, **accepted** 2026-11-06 as decision 6) and `@testing-library/react-native@^14` + `test-renderer@^1` (WU0/WU9 baselines — **implied by** decision 6's structural regression checks, which are impossible without a renderer; confirm). | `react-native-asset`: not installed, `@react-native-community/cli@20` removed `link`, and an unpinned `npx` fetch in a build path is a supply-chain risk. The RN renderer: the user asked for structural regression checks, which are impossible without one — revision 2 claimed them while declaring the same infrastructure out of scope two rows above. | Committing `.ttf` files straight into `android/app/src/main/assets/fonts/` is viable and simpler — chosen only if the pinned tool misbehaves with CLI 20's config shape. |
| **`HomeScreen` structurally rewritten in a "visual only" feature.** | The two-column grid is unreachable from a `.map()` inside a `ScrollView`, and SC-001 (3× more dishes visible) is the feature's headline business case. | `flex-wrap` on the existing map is purely visual and zero-risk but renders every product unvirtualised. **User chose the rewrite**, accepting it as structural. |

---

## Post-Design Constitution Re-check

No new violations. The design strengthens the single-source-of-truth constraint, leaves every multi-tenancy and auth boundary untouched, and adds one deliberate, pinned build-time dependency. **Structural changes beyond pure restyling, and their status:**

| Change | Status |
|---|---|
| `HomeScreen` → owned `FlatList` | **Accepted** 2026-11-06 |
| Coverage-gate exemption | **Accepted** 2026-11-06 |
| Foundation gates authored early | **Accepted** 2026-11-06 |
| Contrast gate reduced to one leg | **Accepted** 2026-11-06 |
| `tokens.raw.js` refactor | Derived from FR-003/FR-007; build-time only, no runtime behaviour |
| `Screen` surface prop | Derived from FR-003's two grounds |
| Role-conditional headers in 3 navigators | ⚠️ **Not yet accepted** — adds role branching to navigation files |
| `react-native-asset` | **Accepted** 2026-11-06 (decision 6) |
| RN renderer for regression checks | ⚠️ **Confirm** — implied by decision 6. **If declined**: drop WU0 + WU9, fall back to the 6 manual regression paths |
