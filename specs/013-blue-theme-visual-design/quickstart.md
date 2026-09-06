# Quickstart: Blue Visual Design System (Zomato-Style Food App UI)

Validates the feature end-to-end once implemented. No backend/API is involved — everything here runs inside `mobile/`.

## Prerequisites

- `mobile/` dependencies installed (`npm install --legacy-peer-deps`)
- The token/component work from `plan.md`'s Project Structure section implemented (`src/theme/`, the new `src/components/*`, and the existing screens updated to consume them)

## 1. Unit-test the contrast gate (FR-012)

```bash
cd mobile
npx jest test/theme/contrastCheck.spec.ts
```

**Expected**: passing cases (e.g., a dark accent color against the light `colors.background`) return `true`; failing cases (e.g., a pale yellow accent against `colors.background`) return `false`. Both a passing and a failing fixture must be present in the test file — a suite with only passing fixtures does not prove the gate rejects anything.

## 2. Unit-test the brand-resolution fallback (FR-011/FR-012)

```bash
npx jest test/theme/resolveBrandTheme.spec.ts
```

**Expected**:
- No brand config supplied → resolved theme equals the Design Token Set's defaults exactly.
- A brand config with a passing `accentColor` → resolved `colors.primary` equals the override; `statusColors`/`typography`/`spacing`/`radius` are untouched.
- A brand config with a failing `accentColor` → resolved `colors.primary` equals the platform default (not the rejected override), and a build-time warning is emitted naming the rejected color.

## 3. Visual check — default (unbranded) build

```bash
npx expo start
```

Open the Student App surface and confirm:
- Home/Product List: image-forward cards, `colors.primary` blue visible on the ADD control (spec User Story 1, Acceptance Scenario 1)
- Adding an item shows the persistent floating cart summary bar without covering the product list (Acceptance Scenario 2)
- Category filters render as pill/chip shapes (Acceptance Scenario 4)
- My Orders / Order Detail: seed or mock one order per status (`payment_pending`, `order_placed`, `payment_failed`, `delivered`) and confirm each renders a distinctly colored `StatusBadge` **and** its text label (Acceptance Scenario 3; spec FR-003)

Then open the Tenant Admin & Staff App surface and confirm the Dashboard/Incoming Orders screens reuse the same `colors.primary` and `StatusBadge` colors (User Story 2).

Then open the System Admin Portal surface and confirm it shares the same palette/typography as the Tenant Admin & Staff App, but its header/navigation carries the distinct "platform-wide" treatment from `PlatformScopeHeader` (User Story 4).

## 4. Visual check — branded build (tenant override)

1. Create a sample `tenant-brand-config.json` conforming to `contracts/tenant-brand-config.schema.json` with an `accentColor` that passes the contrast check (e.g., a dark teal).
2. Re-run the build/bundling step with that config supplied to `resolveBrandTheme.ts`.
3. Confirm: the Student App's primary CTA color reflects the override; the app name/logo reflect the override; status badge colors and `order_placed`'s color are unchanged from the platform default (User Story 3, Acceptance Scenario 1).
4. Repeat with an `accentColor` that fails the contrast check (e.g., a pale yellow) and confirm the build falls back to the platform default blue instead of shipping the failing color (User Story 3, Acceptance Scenario 2).

## 5. Scope-boundary check (FR-013)

Grep the updated screens for anything resembling out-of-scope V1 UI:

```bash
grep -rn -i "rating\|review\|delivery address\|loyalty\|reward" mobile/src/screens/ mobile/src/components/
```

**Expected**: no matches. If any appear, they must be removed before this feature is considered done.

## 6. Token-reuse check (SC-003)

Spot-check a sample of updated screen files for hardcoded colors/font sizes that bypass `tokens.ts`:

```bash
grep -rn "#[0-9A-Fa-f]\{6\}" mobile/src/screens/ | grep -v "theme/tokens.ts\|theme/statusColors.ts"
```

**Expected**: no matches outside the theme module itself — every color used in a screen or component must come from an imported token, not a literal hex string.
