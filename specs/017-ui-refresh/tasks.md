# Tasks: Mobile App UI Refresh

**Input**: Design documents from `/specs/017-ui-refresh/`

**Prerequisites**: [plan.md](./plan.md) (rev 6), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/design-tokens.md](./contracts/design-tokens.md), [quickstart.md](./quickstart.md)

**Tests**: All test tasks live in the final phase (Phase 11), per explicit user instruction. **Mocked only** — no device, no network, no real native module, no real service.

**Organization**: Grouped by user story (US1–US7 = spec priorities P1–P7) so each is independently implementable and shippable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable — different file, no dependency on an incomplete task
- **[Story]**: US1…US7, mapping to the spec's P1…P7

## Path Conventions

Mobile-only. All paths are under `mobile/`. **No task touches `api/` or `mobile/src/api/generated/`** (FR-032, FR-033).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Get the five bundled typefaces onto the device before anything depends on them.

- [X] T001 [P] Pin `react-native-asset` in `mobile/package.json` devDependencies (never invoked via `npx` — supply-chain risk)
- [X] T002 [P] Add a `fonts:link` script to `mobile/package.json` that runs `react-native-asset`
- [!] T003 ⛔ BLOCKED (font binaries not in repo) — [P] Add the five **static instance** faces to `mobile/assets/fonts/`: `BricolageGrotesque-ExtraBold.ttf`, `Inter-Medium.ttf`, `Inter-SemiBold.ttf`, `Inter-Bold.ttf`, `Inter-ExtraBold.ttf` (variable fonts will NOT work — see research R7)
- [!] T004 ⛔ BLOCKED (OFL text ships with the fonts) — [P] Add the OFL licence text to `mobile/assets/fonts/OFL.txt` (both families are OFL; the licence must ship with the app)
- [X] T005 Create `mobile/react-native.config.js` declaring `assets: ['./assets/fonts']`
- [!] T006 ⛔ BLOCKED (needs T003) — Run `npm run fonts:link` and confirm the five faces land in `mobile/android/app/src/main/assets/fonts/` (depends on T001–T005)
- [!] T007 ⛔ BLOCKED (needs T003 + a device) — Rebuild natively and render one sample per face on a device (a throwaway screen, not committed). **`Inter-Bold` and `BricolageGrotesque-ExtraBold` are the critical checks** — faces at weight ≥700 are the ones that fall back to the system font silently. All five must visibly differ from each other and from the system face.

**Checkpoint**: fonts resolve on-device. If T007 fails, stop — every later type decision is invalid.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Settle how text styles are emitted. This decides the shape of US1 and the size of US4–US7.

**⚠️ CRITICAL**: No user story work may begin until this phase completes.

- [X] T008 Spike in `mobile/tailwind.config.js`: prove a plugin using `addUtilities` emits `fontFamily` + `fontSize` + `lineHeight` + `letterSpacing` as **one** utility under NativeWind 4.2. Tailwind's `fontSize` tuple cannot carry `fontFamily`, so without this every text node needs a second `font-*` class.
- [X] T009 Record the spike outcome in `specs/017-ui-refresh/research.md`. **If the plugin route fails**, adopt the paired-class convention (`text-body font-body`) and re-scope US4–US7 to add a family class to ~154 text nodes.

**Checkpoint**: emission strategy decided and written down.

---

## Phase 3: User Story 1 — Design foundations (Priority: P1) 🎯 MVP

**Goal**: One shared definition of colour, type, spacing, radius, status colours and chrome that every screen reads from.

**Independent Test**: launch the app — every screen shows the new ground, espresso text and the bundled typefaces, with no screen file edited.

- [X] T010 [P] [US1] Create `mobile/src/theme/tokens.raw.js` — plain CommonJS, JSDoc `@type` annotated so string literals don't widen and break the typed re-export
- [X] T011 [US1] Rewrite `mobile/src/theme/tokens.ts` as a typed re-export of `tokens.raw.js`, preserving the exported `colors`, `typography`, `spacing`, `radius`, `tokens` shape (depends on T010)
- [X] T012 [P] [US1] Create `mobile/src/theme/accents.ts` with the seven `{soft, strong, dot?}` families — tangerine, sun, mint, red, violet, blue, neutral (FR-003a)
- [X] T013 [US1] Rewrite `mobile/src/theme/statusColors.ts` on top of `accents.ts`; unmapped status falls back to `neutral` with its raw label, never blank (FR-004, depends on T012)
- [X] T014 [US1] Rewrite `mobile/tailwind.config.js` to `require('./src/theme/tokens.raw.js')` instead of restating values (depends on T010)
- [X] T015 [US1] Add the class-compatibility map to `mobile/tailwind.config.js` — keep `text-h1`, `text-h2`, `text-body`, `text-body-bold`, `text-price`, `text-caption`, `text-button` as names and remap their values, so none of the 154 call sites changes (depends on T014)
- [X] T016 [US1] Add the text-style emission to `mobile/tailwind.config.js` per the T008 decision. **No `fontSize` tuple may carry `fontWeight`** — a bundled family plus a numeric weight ≥700 silently renders in the system font (FR-007a, depends on T008, T014)
- [X] T017 [US1] Add `fontFamily` entries to `mobile/tailwind.config.js` for the five bundled faces (depends on T014)
- [X] T018 [US1] Update `mobile/src/theme/navigationHeader.ts` for the two grounds, and **remove `fontWeight: '700'` at lines 12 and 27** — these apply to every stack header in the app (FR-007a, FR-011)
- [X] T019 [US1] Reduce the gate in `mobile/src/theme/brand/resolveBrandTheme.ts` to the **single** espresso-on-brand leg and delete the brand-as-foreground leg. Keeping both is unsatisfiable — it demands `L(brand) ≥ 0.2403` and `≤ 0.1717` (FR-010, research R8)
- [X] T020 [US1] Update `mobile/src/theme/brand/contrastCheck.ts` for the single pairing (depends on T019)
- [X] T021 [US1] Swap the fixtures in `mobile/test/theme/resolveBrandTheme.spec.ts`: `:19`'s `#004D40` (1.66, was the passing case) and `:45`'s `#FFF9C4` (15.19, was the rejection case) both invert. Re-derive as `#FFB020` passing and `#E4572E` failing (depends on T019)
- [X] T022 [US1] Run `npm run typecheck` — must pass with all **13** files importing `theme/tokens` unedited
- [!] T023 ⛔ BLOCKED (needs a device) — [US1] Device check: open five screens across three roles and confirm the new ground, text colour and typefaces are applied with **no file under `mobile/src/screens/` edited**

**Checkpoint**: US1 complete. The whole app has visibly changed and is demoable.

---

## Phase 4: User Story 2 — Shared components (Priority: P2)

**Goal**: Every shared component rebuilt on the foundations, so US4–US7 become small edits.

**Independent Test**: open any screen using each component and compare against the Foundations artboard; every interactive element meets the 44-unit minimum.

- [X] T024 [P] [US2] Restyle `mobile/src/components/PrimaryButton.tsx` — espresso primary, brand variant, disabled distinguished by **dashed outline as well as colour** (FR-012, FR-013)
- [X] T025 [P] [US2] Restyle `mobile/src/components/StatusBadge.tsx` with the four accent pairs + 7px dot; migrate `rounded-full` → `rounded-pill` at line 19 (FR-004)
- [X] T026 [US2] Restyle `mobile/src/components/ProductCard.tsx` — 24-radius card, tinted placeholder, rotated sold-out stamp, ADD → stepper (FR-026, depends on T024)
- [X] T027 [P] [US2] Restyle `mobile/src/components/CartSummaryBar.tsx`; migrate `shadowColor: '#000'` at line 30 to the `shadow` token
- [X] T028 [P] [US2] Restyle `mobile/src/components/PasswordInput.tsx` (FR-016); migrate its brand-as-foreground text at line 37 to `link`
- [X] T029 [P] [US2] Restyle `mobile/src/components/Dropdown.tsx` as the shared picker surface; migrate `bg-black/40` at line 48 to the `scrim` token (FR-020)
- [X] T030 [P] [US2] Restyle `mobile/src/components/CategoryChip.tsx`
- [X] T031 [P] [US2] Restyle `mobile/src/components/NavButton.tsx`
- [X] T032 [P] [US2] Restyle `mobile/src/components/RowActionButton.tsx`; migrate its `text-red-600`/`border-red-600` to `accents.red.strong` and its brand-as-foreground at line 45
- [X] T033 [P] [US2] Restyle `mobile/src/components/EmptyState.tsx`
- [X] T034 [P] [US2] Restyle `mobile/src/components/SkeletonCard.tsx`
- [X] T035 [US2] Add a surface prop to `mobile/src/components/Screen.tsx` so screens declare `background` or `backgroundAlt` instead of it hardcoding `bg-background` at lines 41,47 (FR-003)
- [X] T036 [P] [US2] Restyle `mobile/src/components/BrandRationaleSlider.tsx` — replace the three raw hexes at lines 16, 22, 28 and the `fontSize: 26` at line 71 and `borderRadius: 3` at line 86
- [X] T037 [P] [US2] Restyle `mobile/src/components/PlatformScopeHeader.tsx`. It is dead code — **restyle it, do not delete it**; deleting a file is outside a visual refresh
- [X] T038 [P] [US2] Create `mobile/src/components/OtpDisplay.tsx` — six brand-filled cells, read-only, never shown to staff (FR-017)
- [X] T039 [P] [US2] Create `mobile/src/components/OtpInput.tsx` — six segmented boxes that **clear on an incorrect code** so the operator can retry; the order is unchanged on mismatch (FR-018)
- [X] T040 [P] [US2] Create `mobile/src/components/SwitchRow.tsx` — labelled row with a switch; state conveyed by position **and** label, not colour alone (FR-019)
- [X] T041 [US2] Delete all **12** `font-bold`/`font-semibold` classes across the 8 component files: `CartSummaryBar:37,40`, `CategoryChip:24`, `PasswordInput:37`, `PlatformScopeHeader:14`, `PrimaryButton:48`, `ProductCard:39,59,61,68`, `RowActionButton:45`, `StatusBadge:20` (FR-007a)
- [X] T042 [US2] Raise every touch target in `mobile/src/components/` to **44×44**, including where an artboard shows 40 (ADD control) or 34×40 (stepper segments) (FR-015)

**Checkpoint**: US1 + US2 complete and independently demoable.

---

## Phase 5: User Story 3 — Brand (Priority: P3)

**Goal**: The new mark is visible before the app opens.

**Independent Test**: install the build — the launcher icon is the new mark and masks correctly; the splash shows the new logo.

> Independent of US2; may run in parallel with Phase 4.

- [ ] T043 [P] [US3] Generate adaptive launcher icon layers from `mobile/assets/brand/gf-icon-v2.png` into `mobile/android/app/src/main/res/mipmap-*/` (FR-022)
- [ ] T044 [P] [US3] Set the adaptive-icon background in `mobile/android/app/src/main/res/values/ic_launcher_background.xml`
- [ ] T045 [US3] Restyle `mobile/src/screens/student/SplashScreen.tsx` with `gf-logo-v2.png` on a brand ground (FR-023, FR-029 — no artboard, follow established patterns)
- [ ] T046 [US3] Install the build and verify the launcher icon from `mobile/android/app/src/main/res/mipmap-*/` renders correctly under **round, squircle and square** masking

**Checkpoint**: US3 complete and independently shippable.

---

## Phase 6: User Story 4 — Auth (Priority: P4)

**Goal**: Login, registration and both forgot-password steps in the new design, with fields and rules untouched.

**Independent Test**: register, sign out, sign in, run a full password reset — every step matches its artboard and every field, rule and message is identical to before.

- [ ] T047 [US4] Restyle `mobile/src/screens/student/LoginScreen.tsx` against the `Login` artboard; migrate its `text-red-600` and `text-slate-500` classes at lines 89, 91, 94
- [ ] T048 [US4] Restyle `mobile/src/screens/student/RegisterScreen.tsx` against the `Register` artboard. **Keep the `gender` control** — the artboard omits it but the API requires it; render it in the artboard's own segmented-chip pattern (FR-030, research R6)
- [ ] T049 [P] [US4] Restyle `mobile/src/screens/student/ForgotPasswordRequestScreen.tsx` from the `Login` input + primary-button pattern (FR-029 — no artboard)
- [X] T050 [P] [US4] Restyle `mobile/src/screens/student/ForgotPasswordVerifyScreen.tsx` using `OtpInput` from T039 (FR-029 — no artboard; pattern source is the `Fulfilment` board)
- [X] T051 [US4] Route `mobile/src/navigation/AuthNavigator.tsx:44`'s inline `headerStyle` through `navigationHeader.ts` as a **third, auth-specific option set preserving its current background and tint**. It must NOT point at the brand header — commit `c2b7b0c` deliberately made the Login header match the screen background
- [X] T052 [US4] Remove the `font-*` weight classes and migrate the off-palette colour classes in `mobile/src/screens/student/{Login,Register,ForgotPasswordRequest,ForgotPasswordVerify}Screen.tsx` and `mobile/src/navigation/AuthNavigator.tsx`
- [ ] T053 [US4] Manual review of all four screens against the `Login` and `Register` artboards, plus regression path 1 in `quickstart.md`

**Checkpoint**: US4 complete and independently demoable.

---

## Phase 7: User Story 5 — Student journey (Priority: P5)

**Goal**: Menu, side menu, cart, order confirmation, order detail and history in the new design.

**Independent Test**: place an order end to end — every screen matches its artboard and the order behaves exactly as today.

- [X] T054 [US5] Rewrite `mobile/src/screens/student/HomeScreen.tsx` as a two-column grid: `<Screen scroll={false}>` + an owned list with two columns. It is currently a `.map()` inside a `ScrollView`, so this **introduces** virtualisation rather than preserving it (FR-025, research R12)
- [X] T055 [US5] Add bottom content inset to the Home list so `CartSummaryBar`'s absolute overlay (`left-4 right-4 bottom-4`) stops permanently hiding the last row (depends on T054)
- [X] T056 [US5] Move Home's empty and skeleton states into the list's own empty/header slots. **Note**: there is no `RefreshControl` today — `load()` runs once from `useEffect`, so no pull-to-refresh is preserved and none is added (depends on T054)
- [X] T057 [US5] Restyle `mobile/src/screens/student/CartScreen.tsx`; migrate its brand-as-foreground ± controls at lines 153, 157 to `espresso`
- [X] T058 [US5] Restyle `mobile/src/screens/student/OrderDetailScreen.tsx` for the `payment_failed` state against the `OrderDetail` artboard; migrate the brand-as-foreground code at line 154
- [X] T059 [US5] Restyle `OrderDetailScreen.tsx` for the `order_placed` state against the `OrderSuccess` artboard — **full-bleed brand ground**, six `OtpDisplay` cells. No new screen or route (depends on T058)
- [ ] T060 [US5] Restyle `mobile/src/screens/student/MyOrdersScreen.tsx` against the `MyOrders` artboard; Upcoming/History split unchanged
- [X] T061 [US5] Rewrite the drawer content in `mobile/src/navigation/AppShell.tsx` to show **name and canteen only**. The role currently renders at line 65 and must be **removed** (FR-027)
- [ ] T062 [US5] Restyle the student drawer variant in `AppShell.tsx` against the `Drawer` artboard; menu items byte-identical to today (FR-028, depends on T061)
- [X] T063 [P] [US5] Give `mobile/src/navigation/RootNavigator.tsx` a declared surface — it hardcodes `bg-background` on its loading view at line 18
- [ ] T064 [P] [US5] Restyle `mobile/src/navigation/StudentNavigator.tsx`
- [X] T065 [US5] Remove the `font-*` weight classes and migrate the off-palette colour classes in `mobile/src/screens/student/{Home,Cart,OrderDetail,MyOrders}Screen.tsx` and `mobile/src/navigation/{AppShell,RootNavigator,StudentNavigator}.tsx`
- [ ] T066 [US5] Manual review against the `Home`, `Drawer`, `Cart`, `OrderSuccess`, `OrderDetail` and `MyOrders` artboards, plus regression paths 2–3 in `quickstart.md`

**Checkpoint**: US5 complete — the headline business case (SC-001) is demonstrable.

---

## Phase 8: User Story 6 — Shared screens (Priority: P6)

**Goal**: Profile, edit profile, change password, Contact Us and Feedback in the new design.

**Independent Test**: as each role, open all five screens; each matches its artboard or the established patterns, with fields and rules unchanged.

- [ ] T067 [P] [US6] Restyle `mobile/src/screens/shared/ProfileScreen.tsx` against the `Profile` artboard; read-only username uses the dashed treatment (FR-016)
- [ ] T068 [P] [US6] Restyle `mobile/src/screens/shared/EditProfileScreen.tsx` from the `Profile` + `UserForm` field patterns (FR-029 — no artboard)
- [ ] T069 [P] [US6] Restyle `mobile/src/screens/shared/ChangePasswordScreen.tsx` from the `Login` password-field pattern (FR-029 — no artboard)
- [X] T070 [US6] Restyle `mobile/src/screens/shared/ContactUsScreen.tsx` against the `ContactUs` artboard. Migrate the brand-coloured phone and email at lines 71, 78 to the `link` token. **Keep the existing dialler/mail behaviour from specs/015 — FR-038 bars ADDING the affordance, and removing it would breach FR-030**
- [ ] T071 [P] [US6] Restyle `mobile/src/screens/shared/FeedbackScreen.tsx` against the `Feedback` artboard; replace the raw hex at line 167 and the `fontSize: 28` at line 148. Rating, the six fixed categories and the contact-back option are unchanged
- [ ] T072 [P] [US6] Restyle `mobile/src/navigation/ProfileNavigator.tsx`, `ContactUsNavigator.tsx` and `FeedbackNavigator.tsx`. **Do not add role-conditional header logic** unless Open Decision 1 in `plan.md` is accepted
- [X] T073 [US6] Remove the `font-*` weight classes and migrate the off-palette colour classes in `mobile/src/screens/shared/*.tsx` and the three shared navigators in `mobile/src/navigation/`
- [ ] T074 [US6] Manual review against the `Profile`, `ContactUs` and `Feedback` artboards

**Checkpoint**: US6 complete and independently demoable.

---

## Phase 9: User Story 7 — Admin & Staff (Priority: P7)

**Goal**: All 13 back-of-house screens and both back-of-house drawers in the new design.

**Independent Test**: as staff, work the queue and verify a code; as Company Admin, create and edit a product, category, department and user, and resolve feedback. Every screen matches its artboard and behaves as today.

- [ ] T075 [US7] Restyle `mobile/src/screens/tenant-admin-staff/DashboardScreen.tsx` against the `Dashboard` artboard — stat cards keep their live counts. **No open/closed toggle may be added** (FR-036); migrate the `fontSize: 22` at line 94 and `rounded-full` at line 91
- [ ] T076 [US7] Restyle `mobile/src/screens/tenant-admin-staff/ProductListScreen.tsx` admin variant against `AdminProducts` — full CRUD; migrate the inline `fontWeight: '700'`/`fontSize: 15` at line 84
- [X] T077 [US7] Restyle the staff variant of `ProductListScreen.tsx` against `StaffProducts` — **sold-out `SwitchRow` only**, no create, edit or delete (depends on T040, T076)
- [ ] T078 [P] [US7] Restyle `mobile/src/screens/tenant-admin-staff/ProductCreateEditScreen.tsx` from the `UserForm`/`CategoryForm` patterns (FR-029 — no artboard); migrate its two `font-semibold` at lines 219, 249
- [ ] T079 [P] [US7] Restyle `mobile/src/screens/tenant-admin-staff/CategoryListScreen.tsx` against `Categories`; migrate the inline `fontWeight`/`fontSize` at line 66
- [ ] T080 [P] [US7] Restyle `mobile/src/screens/tenant-admin-staff/CategoryCreateEditScreen.tsx` against `CategoryForm`; migrate its `font-semibold` at line 87
- [ ] T081 [P] [US7] Restyle `mobile/src/screens/tenant-admin-staff/DepartmentListScreen.tsx` against `Departments`; migrate the inline `fontWeight`/`fontSize` at line 64
- [ ] T082 [P] [US7] Restyle `mobile/src/screens/tenant-admin-staff/DepartmentCreateEditScreen.tsx` against `DepartmentForm`; migrate its `font-semibold` at line 87
- [ ] T083 [P] [US7] Restyle `mobile/src/screens/tenant-admin-staff/UserListScreen.tsx` against `Users`; migrate the inline `fontWeight`/`fontSize` at line 57
- [ ] T084 [US7] Restyle `mobile/src/screens/tenant-admin-staff/UserCreateEditScreen.tsx` against `UserForm`. Role options stay **Company Staff / Student / Teaching / Non-Teaching — no Company Admin** (FR-039); Category stays required when the role is Student (FR-040); migrate its `font-semibold` at line 221
- [ ] T085 [P] [US7] Restyle `mobile/src/screens/tenant-admin-staff/IncomingOrdersScreen.tsx` against `IncomingOrders` — oldest-first order preserved
- [X] T086 [US7] Restyle `mobile/src/screens/tenant-admin-staff/OrderFulfilmentScreen.tsx` against `Fulfilment` using `OtpInput`. **The pickup code is never displayed to staff**; a wrong code clears the boxes and changes nothing (FR-018, depends on T039)
- [ ] T087 [P] [US7] Restyle `mobile/src/screens/tenant-admin-staff/FeedbackListScreen.tsx` against `FeedbackReview`; migrate its `text-primary` at line 132 and `font-semibold` at line 118
- [ ] T088 [US7] Restyle `mobile/src/screens/tenant-admin-staff/FeedbackDetailScreen.tsx` against `FeedbackDetail`. **Resolve stays one-way — no path back to unresolved** (FR-041); migrate its amber/green tints at lines 110, 114, 115 to `accents.sun`/`accents.mint`
- [ ] T089 [US7] Restyle the company_admin and company_staff drawer variants in `mobile/src/navigation/AppShell.tsx` against `AdminDrawer` and `StaffDrawer`; menu items byte-identical to today (depends on T061)
- [ ] T090 [P] [US7] Restyle `mobile/src/navigation/TenantAdminStaffNavigator.tsx`
- [X] T091 [US7] Remove any remaining `font-*` weight classes and off-palette colour classes in `mobile/src/screens/tenant-admin-staff/*.tsx` and `mobile/src/navigation/TenantAdminStaffNavigator.tsx`
- [ ] T092 [US7] Manual review against all 13 back-of-house artboards plus `AdminDrawer` and `StaffDrawer`, and regression paths 4–6 in `quickstart.md`

**Checkpoint**: all seven user stories complete.

---

## Phase 10: Cross-cutting cleanup

- [X] T093 Sweep `mobile/src/` for any remaining raw hex, `fontSize`, `fontWeight` or `borderRadius` literal and migrate it to a token
- [X] T094 Sweep `mobile/src/` for any remaining `rounded-full` and migrate to `rounded-pill`
- [ ] T095 Confirm `mobile/src/api/generated/` and `api/` are untouched: `git diff --stat main..HEAD -- api/ mobile/src/api/` must return nothing (FR-032, FR-033)

---

## Phase 11: Tests & coverage (final)

**Purpose**: the eleven gates, authored and run here per user instruction. **Mocked only** — no device, no network, no real native module, no real database or service. Per `CLAUDE.md`, a test must never reach a live backend.

> **Known consequence**: `classnames.spec` and `fonts.spec` detect the two failure modes that leave `typecheck` and the build green. Running them here means they **report** damage rather than prevent it — a class broken in US1 surfaces only now. The per-phase manual reviews above are the substitute and must actually have been done.

- [X] T096 [P] Write `mobile/test/theme/tokens.spec.ts` — `tokens.ts` deep-equals `tokens.raw.js` (G5)
- [X] T097 [P] Write `mobile/test/theme/contrast.spec.ts` — all 7 accent pairs ≥4.5:1; espresso-on-brand per swatch; a failing colour warns and falls back **and a passing colour is accepted** (G2, G4, SC-005, SC-008)
- [X] T098 [P] Write `mobile/test/theme/fonts.spec.ts` — every token's family is bundled, and **no numeric font weight appears anywhere in `mobile/src/`**: style prop, `font-{thin…black}` class, or `headerTitleStyle` (G3, FR-007a)
- [X] T099 [P] Write `mobile/test/theme/classnames.spec.ts` (G7). Enumerate by having the text-style plugin export its utility key list, unioned with `resolveConfig().theme` — `resolveConfig` does **not** reflect plugins. Extract class names by AST walk over JSX string literals, not regex. Normalise opacity modifiers. Use an **allow-list**, so `text-red-600` fails. **Exempt** non-themed utilities: `text-center`, `text-left/right`, `border-t`, `border-b`, bare `border`
- [X] T100 [P] Write `mobile/test/theme/token-discipline.spec.ts` — no raw hex, radius or size literal in `src/screens` or `src/components` (O1, SC-004)
- [X] T101 [P] Write `mobile/test/theme/brand.spec.ts` — only `primary` differs across resolved themes (G1, FR-009)
- [X] T102 [P] Write `mobile/test/theme/statusColors.spec.ts` — unknown status → `neutral` + raw label; no screen imports `accents` directly (G6, O3)
- [X] T103 [P] Write `mobile/test/theme/surface.spec.ts` — every screen declares a ground; none hardcodes one. **Exempt** the three non-ground decorative fills: `ProductCard.tsx:31`, `ProductListScreen.tsx:174`, `ProductCreateEditScreen.tsx:213` (O2)
- [X] T104 [P] Write `mobile/test/theme/touch-targets.spec.ts` — AST scan asserting every pressable's `h-`/`min-h-`/`height` is ≥44 (O4, SC-006)
- [X] T105 Run `npm test` in `mobile/` — all eleven gates across nine spec files must pass
- [X] T106 Verify the six prohibitions by inspection (SC-010): no open/closed toggle (FR-036), no menu search or filter (FR-037), no tap-to-call or tap-to-email (FR-038), no Company-Admin-creates-Company-Admin (FR-039), Category still required for Student (FR-040), feedback resolve still one-way (FR-041)
- [ ] T107 Run the full `quickstart.md` sign-off: fresh install, all five faces render and differ, all 27 screen files reviewed, all 10 edge-case rows exercised, all 6 regression paths identical to the previous build
- [ ] T108 Run `/self-reflect` and commit knowledge-base updates (mandatory before PR per `CLAUDE.md`)
- [ ] T109 Open the PR

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 Setup** — no dependencies; T007 gates everything
- **Phase 2 Foundational** — depends on Phase 1; **blocks all user stories**
- **Phase 3 US1** — depends on Phase 2; **blocks US2 and US4–US7**
- **Phase 4 US2** — depends on US1; blocks US4–US7
- **Phase 5 US3** — depends on Phase 1 only; **parallel with Phase 4**
- **Phases 6–9 US4–US7** — depend on US1 + US2; mutually parallel except where noted
- **Phase 10 cleanup** — after all stories
- **Phase 11 tests** — last

```
Phase1 ─→ Phase2 ─→ US1 ─→ US2 ─┬→ US4
   └──────────────→ US3         ├→ US5
                                 ├→ US6
                                 └→ US7
                                      ↓
                              Phase10 ─→ Phase11
```

### Story independence — honest assessment

| Story | Independently shippable? |
|---|---|
| US1 | **Yes** — recolours and re-types the whole app on its own |
| US2 | **Yes** — needs US1's tokens, but is demoable and reviewable alone |
| US3 | **Yes** — fully independent of US2 and all screen stories |
| US4–US7 | **Yes, once US1+US2 land.** Mutually independent: no task in one touches a file in another. The only shared file is `AppShell.tsx` — T061/T062 (US5) and T089 (US7) — so US7's drawer work depends on US5's drawer rewrite |

### Parallel opportunities

- T001–T004 together (Phase 1)
- Phase 5 (US3) entirely parallel with Phase 4 (US2)
- Within US2: T024–T040 are almost all `[P]`, except T026 (needs T024), T035 and T041–T042
- Within US7: T078–T085, T087, T090 are `[P]`
- Phase 11: T096–T104 all `[P]`

---

## Implementation Strategy

### MVP — US1 only

1. Phase 1 Setup → fonts render on-device (T007 is the hard gate)
2. Phase 2 Foundational → emission strategy decided
3. Phase 3 US1 → **stop and validate**: the whole app has visibly changed with no screen edited
4. Demo

### Incremental delivery

US1 → US2 → US3 → US4 → US5 → US6 → US7, demoing after each. US5 is where the headline business case (SC-001: 3× more dishes visible) becomes demonstrable.

### Notes

- `[P]` = different file, no dependency on an incomplete task
- No task touches `api/` or `mobile/src/api/generated/` — verified mechanically, and re-verified by T095
- Reverting this feature requires a **new native build** — fonts are platform assets, so there is no partial rollback
- Commit after each task or logical group; stop at any checkpoint to validate a story independently
