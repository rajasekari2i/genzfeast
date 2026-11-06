# Contract: Design Token Module

**Feature**: 017-ui-refresh | **Revision**: 5 (re-planned: all gates in the final phase) | **Consumers**: every screen and component in `mobile/src`

Supersedes `specs/013-blue-theme-visual-design/contracts/design-tokens.md`. The mechanism 013 established (one token module, one tenant-overridable colour, a contrast gate) is retained; values and structure grow.

> **Revision 3**: adds G7 (class-name compatibility — the surface that actually breaks), makes G2 warn-and-fallback **and single-leg**, widens G3 to every numeric weight in `src/`, makes O1 a palette allow-list, and gives every guarantee an authored-in / enforced-from pair.

---

## 1. Module surface

```
mobile/src/theme/tokens.raw.js     raw values, CommonJS — the single source
mobile/src/theme/tokens.ts         typed re-export; TS import surface
mobile/src/theme/accents.ts        accent-pair lookups
mobile/src/theme/statusColors.ts   order status → accent pair
mobile/tailwind.config.js          requires tokens.raw.js; hosts the class layer
```

**TS compatibility**: `tokens.ts` MUST keep exporting `colors`, `typography`, `spacing`, `radius`, `tokens`, with `ColorTokens.primary` typed as `string`. `colors` MAY gain keys; it MUST NOT lose `primary`, `primaryVariant`, `accent`, `secondary`, `surface`, `background`, `textPrimary`, `textSecondary`, `border`.

**Scope note**: 13 files import this module; **none** import `typography` or `radius`. The TS surface is therefore the *smaller* risk. See G7.

---

## 2. Guarantees

| # | Guarantee |
|---|---|
| **G1** | `primary` is the only value a tenant build may override. Every other token is identical across tenants. |
| **G2** | A tenant `primary` failing 4.5:1 **as a fill behind espresso text** is rejected: the system warns and falls back to the default. It does not fail the build. The gate checks **only** this pairing — adding a brand-as-foreground leg makes the constraint set empty (research R8). At least one non-default colour must be demonstrably accepted. |
| **G3** | Every typography token resolves to a bundled font file, and **no numeric font weight appears anywhere in `src/`** — not as a style property, not as a `font-{thin…black}` class, not in `headerTitleStyle`. |
| **G4** | Every accent pair satisfies 4.5:1 (`strong` on `soft`). |
| **G5** | `tokens.ts` and `tailwind.config.js` cannot disagree: both derive from `tokens.raw.js`. |
| **G6** | An order status with no accent mapping renders with the `neutral` pair and its raw label. Never blank. |
| **G7** | **Every utility class name used in `src/` resolves to a foundation definition, and no class resolves to an off-foundation value.** Covers `text-*`, `bg-*`, `border-*`, `rounded-*` **and `font-*`**. A class that silently stops applying, *or that silently applies a colour the foundations do not define*, is a breaking change. |

## 3. Obligations on consumers

| # | Obligation |
|---|---|
| **O1** | No raw colour, radius or font size/weight literal in a screen or component — **and no styling class drawn from outside the foundation palette** (an allow-list, not a "known to Tailwind" check). |
| **O2** | Surface choice is explicit: student screens use `background`, back-of-house use `backgroundAlt`. No screen hardcodes either. **Exempt**: non-ground decorative fills — `ProductCard.tsx:31` (image placeholder → the tint rotation), `ProductListScreen.tsx:174` and `ProductCreateEditScreen.tsx:213` (thumbnail/preview boxes → `accents.neutral.soft`). These are surfaces *within* a screen, not its ground. |
| **O3** | Status presentation goes through `statusColors.ts`. No screen maps a status to a colour itself. |
| **O4** | Interactive elements present ≥44×44 touch targets, even where an artboard shows less. |

## 4. Non-goals

Dark mode; runtime theming; per-tenant typography, spacing or radius; iOS font registration (no iOS project); interpolated font weights (Option C in research R7 — rejected for this feature).

## 5. Verification

**All checks are authored and run in P8, the final phase** — per user instruction, and consistent with `CLAUDE.md`'s implementation-before-tests rule. They are **mocked only**: no device, no network, no real native module.

| # | Check | Asserts |
|---|---|---|
| G1 | `theme/brand.spec` | only `primary` differs across resolved themes |
| G2 | `theme/contrast.spec` | espresso-on-brand per swatch; a failing colour warns and falls back; **a passing colour is accepted** |
| G3 | `theme/fonts.spec` | every token's family is bundled, and **no numeric font weight appears anywhere in `src/`** — style prop, `font-{thin…black}` class, or `headerTitleStyle` |
| G4 | `theme/contrast.spec` | all 7 accent pairs ≥4.5:1 |
| G5 | `theme/tokens.spec` | `tokens.ts` deep-equals `tokens.raw.js` |
| G6 | `theme/statusColors.spec` | unknown status → `neutral` + raw label |
| G7 | `theme/classnames.spec` | see enumeration method below |
| O1 | `theme/token-discipline.spec` | no raw literal; palette allow-list |
| O2 | `theme/surface.spec` | every screen declares a ground; none hardcodes one |
| O3 | `theme/statusColors.spec` | no screen imports `accents` directly |
| O4 | `theme/touch-targets.spec` | AST scan — every pressable's height ≥44 |

**Eleven gates across nine spec files** (G2/G4 share `contrast.spec`; G6/O3 share `statusColors.spec`).

### Consequence of running last — stated, not hidden

**G7 and G3 detect the two failure modes that are otherwise invisible**: a class that silently stops applying, and a bundled family that silently falls back to the system font. Both leave `tsc` and the build green. Running them in P8 means they **report** damage rather than **prevent** it — a class broken in P1 may go unnoticed until P8.

The substitutes during P1–P7 are manual and must actually be performed:
- **P1 ends with a per-face device check** — render one sample per bundled face; Inter-Bold and BricolageGrotesque-ExtraBold are the meaningful ones, since the ≥700 faces are what fail silently.
- **Each screen phase ends with a manual artboard review** against the table in `quickstart.md`.

### G7 enumeration method

`resolveConfig(...).theme` reflects **`theme` only, not `plugins`** — it would report the seven plugin-emitted text utilities as missing and fail on 154 call sites. The check must therefore:

1. **Enumerate** by having the text-style plugin export its utility key list for the test to `require`, unioned with `resolveConfig(...).theme` for colours, radii and spacing.
2. **Extract** class names by AST walk over JSX string literals — not a regex over `className="…"`, which misses ternaries (`RowActionButton.tsx:39,45`), template literals and a class held in a variable (`PrimaryButton.tsx:32`), and would false-positive on the commented class at `PrimaryButton.tsx:26`.
3. **Normalise** opacity modifiers before lookup (`bg-text-primary/70`, `bg-surface/20`).
4. **Allow-list**, not existence-check: a class resolving to Tailwind's default palette (`text-red-600`) must FAIL, even though it resolves fine.
5. **Exempt non-themed core utilities** under the scanned prefixes, or the gate fails on correct code: `text-center` (25 sites), `text-left`/`text-right`, `border-t` (4), `border-b` (11) and bare `border` carry no theme key. Match only the **value segment** against theme keys.

## 6. Known defect in the upstream design

`#E4572E`, offered as a tenant swatch in the canvas's `data-props`, scores **4.42:1** against espresso as a fill and **3.50:1** as a foreground — failing G2. Report to the designer. **Not a gate on this feature's completion.**
