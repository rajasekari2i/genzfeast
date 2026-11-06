# Quickstart: Validating the UI Refresh

**Feature**: 017-ui-refresh | **Date**: 2026-11-06

How to run the refreshed app and prove it satisfies the spec. Token values live in [`data-model.md`](./data-model.md); guarantees in [`contracts/design-tokens.md`](./contracts/design-tokens.md); measurement findings in [`research.md`](./research.md).

---

## Prerequisites

- Android device or emulator (no iOS project exists in this repo)
- A configured `mobile/.env` with `COMPANY_ID`, `API_BASE_URL`, `RAZORPAY_KEY_ID`
- A reachable API with at least: one canteen with **6+ products, one of them sold out and one without a photo**; a student account; a staff account; a company-admin account; one order in each of `payment_pending`, `order_placed`, `payment_failed`, `delivered`

> **A fresh install is required, not a Metro reload.** This feature bundles fonts into the Android assets, which only takes effect on a native rebuild.

```bash
cd mobile
npm install
npm run fonts:link            # pinned react-native-asset; copies assets/fonts into android/
npm run android               # full rebuild
```

## Automated gates

```bash
cd mobile
npm run typecheck             # must pass — 13 files import the token module
npm test                      # includes the new token-discipline and contrast tests
```

| Gate | Asserts | Spec |
|---|---|---|
| `theme/tokens.spec` | `tokens.ts` deep-equals `tokens.raw.js` | G5 |
| `theme/contrast.spec` | 7 accent pairs ≥4.5:1; **espresso-on-brand only** per swatch; a failing colour warns + falls back **and a passing colour is accepted** | G2, G4, SC-005 |
| `theme/fonts.spec` | every typography token's family is bundled **and no numeric font weight appears anywhere in `src/`** — style prop, `font-*` class, or `headerTitleStyle` | G3, FR-007a |
| **`theme/classnames.spec`** | **no `text-*`/`bg-*`/`border-*`/`rounded-*` in `src/**` is missing from the generated theme** | **G7, SC-004** |
| `theme/token-discipline.spec` | no raw hex / radius / size literal in screens or components | O1, SC-004 |
| `theme/brand.spec` | only `primary` differs across resolved themes | G1 |
| `theme/statusColors.spec` | unknown status → `neutral` + raw label; no screen imports `accents` directly | G6, O3 |
| `theme/surface.spec` | every screen declares `background` or `backgroundAlt`; none hardcodes a ground | O2 |
| `theme/touch-targets.spec` | AST scan: every pressable's `h-`/`min-h-`/`height` ≥44 | O4, SC-006 |

**Eleven gates (G1–G7, O1–O4) across nine spec files** — G2/G4 share `contrast.spec`, G6/O3 share `statusColors.spec`. `classnames.spec` and `fonts.spec` are the two that catch *silent* failures — an unknown class and a wrong font face both leave `tsc` and the build green.

**Font check — do this first.** A wrong convention fails *silently*, and only for weights ≥700, so body text looks right while every heading is the system font:

```
Render one sample per bundled face:
  BricolageGrotesque-ExtraBold   ← the critical check
  Inter-Bold                     ← the critical check
  Inter-ExtraBold
  Inter-SemiBold
  Inter-Medium

All five MUST visibly differ from each other and from the system face.
If the two "critical check" samples look like the system font bolded,
the family/weight convention is wrong — stop and fix before any screen work.
No sample may set fontWeight.
```

---

## Screen-by-screen review

Each row names its artboard. For every screen confirm: **(a)** it matches the artboard's layout and hierarchy, **(b)** its fields, labels, validation and actions are unchanged from before this feature, **(c)** it contains no off-token colour or radius.

### Student journey — ground: cream `#FFF8F1`

| # | Screen | Artboard | Watch for |
|---|---|---|---|
| 1 | `student/SplashScreen` | *(none — derive)* | Brand mark on cream; no old grey |
| 2 | `student/LoginScreen` | `Login` | Espresso primary button, 52 tall, pill |
| 3 | `student/RegisterScreen` | `Register` | **Gender control must still be present** — the artboard omits it (R6). Category renders as the "I am a…" chip row |
| 4 | `student/ForgotPasswordRequestScreen` | *(none — derive)* | Input + primary button patterns only |
| 5 | `student/ForgotPasswordVerifyScreen` | *(none — derive)* | Code entry legible; no invented layout |
| 6 | `student/HomeScreen` | `Home` | **Two-column grid**; tinted placeholders; rotated SOLD OUT stamp; ADD → stepper |
| 7 | `student/CartScreen` | `Cart` | Steppers ≥44px; total hierarchy |
| 8 | `student/OrderDetailScreen` (`order_placed`) | `OrderSuccess` | **Full-bleed brand background**; six pickup digits at 36pt Bricolage |
| 9 | `student/OrderDetailScreen` (`payment_failed`) | `OrderDetail` | Cream ground; red chip; Pay Again prominent |
| 10 | `student/MyOrdersScreen` | `MyOrders` | Upcoming/History split unchanged; chips correct per status |
| 11 | `shared/ProfileScreen` | `Profile` | Read-only username shows dashed treatment |
| 12 | `shared/EditProfileScreen` | *(none — derive)* | Editable vs read-only fields differ by border style, not colour alone |
| 13 | `shared/ChangePasswordScreen` | *(none — derive)* | — |
| 14 | `shared/FeedbackScreen` | `Feedback` | Rating + the six fixed categories unchanged |
| 15 | `shared/ContactUsScreen` | `ContactUs` | Unset operating hours still reads "Not specified" |

### Back-of-house — ground: warm grey `#F5F3EF`, navy chrome

| # | Screen | Artboard | Watch for |
|---|---|---|---|
| 16 | `tenant-admin-staff/DashboardScreen` | `Dashboard` | Stat cards keep live counts |
| 17 | `ProductListScreen` (admin) | `AdminProducts` | Full CRUD actions |
| 18 | `ProductListScreen` (staff) | `StaffProducts` | **Sold-out toggle only** — no create/edit/delete |
| 19 | `ProductCreateEditScreen` | *(none — derive)* | Image upload control restyled, behaviour unchanged |
| 20 | `CategoryListScreen` | `Categories` | — |
| 21 | `CategoryCreateEditScreen` | `CategoryForm` | — |
| 22 | `DepartmentListScreen` | `Departments` | — |
| 23 | `DepartmentCreateEditScreen` | `DepartmentForm` | — |
| 24 | `UserListScreen` | `Users` | — |
| 25 | `UserCreateEditScreen` | `UserForm` | Gender **and** Role controls both present; Category required only for Student |
| 26 | `IncomingOrdersScreen` | `IncomingOrders` | Oldest-first order preserved |
| 27 | `OrderFulfilmentScreen` | `Fulfilment` | Code entry; mismatch error inline; **code never displayed to staff** |
| 28 | `FeedbackListScreen` | `FeedbackReview` | new/resolved filter unchanged |
| 29 | `FeedbackDetailScreen` | `FeedbackDetail` | Resolve is one-way |

### Navigation chrome

| # | Surface | Artboard | Watch for |
|---|---|---|---|
| 30 | `AppShell` (student) | `Drawer` | Home · Cart · My Orders · Profile · Contact Us · Feedback |
| 31 | `AppShell` (company_admin) | `AdminDrawer` | 9 items incl. Feedback Review |
| 32 | `AppShell` (company_staff) | `StaffDrawer` | Incoming Orders · Products + shared items |
| — | `teaching` / `non_teaching` | *(uses `Drawer` shell)* | Profile · Contact Us · Feedback **only** |

---

## Edge cases (spec §Edge Cases)

| Case | How to produce | Expected |
|---|---|---|
| Dish without a photo | Product with null `image_url` | Designed tinted placeholder with glyph — never a broken image |
| Long dish name | Rename a product to 40+ chars | Truncates on one line; cards in a row stay equal height |
| One dish / none | Canteen with 1 then 0 products | No broken half-row; designed empty state |
| Large system font | Android → Display size → Largest | Pickup digits, chips and buttons legible and unclipped |
| Narrow screen | 320dp-width emulator | Two readable columns persist |
| Unmapped status | Force an unexpected status value | `neutral` chip with raw label — never blank |
| Failing brand | Set brand to `#E4572E` | **Warns and falls back to default** (4.42:1 espresso-on-fill). Confirms G2 — note it does *not* fail the build |
| Passing brand | `#FFB020` via `theme/contrast.spec` | **Accepted** (8.90:1). Proves the override path still works. **Unit assertion, not a device check** — the resolver has no production call site |
| Font missing | Remove a `.ttf`, run `npm test` | **`theme/fonts.spec` fails.** The Gradle build itself still succeeds — `react-native-asset` silently copies nothing — so the test gate is the real guard |
| Font unresolvable at runtime | Reference an unbundled family name | Falls back to a readable system face; layout intact |

---

## Regression check (SC-003: zero behavioural change)

Do this against the previous build, same account, same data:

1. Register a student — same fields, same validation messages, same success path.
2. Place an order — same unavailable-item rejection; same single-unresolved-order rule.
3. Fail a payment, then Pay Again — same order id, no duplicate.
4. Fulfil with a wrong code, then the right one — same error, same `409` on re-submit.
5. Forgot password end to end — same channel behaviour per the canteen's `is_sms`.
6. Sign in as each of the five tenant roles — identical menu items to before.

**Any difference other than appearance is a defect in this feature.**

---

## Sign-off

- [ ] Fresh install; **all five faces render and visibly differ**
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes — **all eleven gates across nine spec files**
- [ ] All **27 screen files** reviewed against the table above, plus the three drawer variants
- [ ] All **10 edge-case rows** exercised (covering the spec's 8 cases)
- [ ] All 6 regression paths identical to the previous build
- [ ] WU9 structural assertions pass (fields, labels, validation, actions unchanged)

**Reported as outputs of this feature, not gates on it**: the `#E4572E` swatch defect, and the `PlatformScopeHeader` dead-code disposition.
