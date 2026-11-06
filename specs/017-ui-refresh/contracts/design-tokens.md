# Contract: Design Token Module

**Feature**: 017-ui-refresh | **Revision**: 2 (post review gate) | **Consumers**: every screen and component in `mobile/src`

Supersedes `specs/013-blue-theme-visual-design/contracts/design-tokens.md`. The mechanism 013 established (one token module, one tenant-overridable colour, a contrast gate) is retained; values and structure grow.

> **Revision 2**: adds G7 (class-name compatibility — the surface that actually breaks), makes G2 warn-and-fallback rather than build-failing, makes the gate additive, and gives every guarantee and obligation a named check. Revision 1's "16 importers" figure was wrong (actual: 13) and protected the wrong surface.

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
| **O2** | Surface choice is explicit: student screens use `background`, back-of-house use `backgroundAlt`. No screen hardcodes either. |
| **O3** | Status presentation goes through `statusColors.ts`. No screen maps a status to a colour itself. |
| **O4** | Interactive elements present ≥44×44 touch targets, even where an artboard shows less. |

## 4. Non-goals

Dark mode; runtime theming; per-tenant typography, spacing or radius; iOS font registration (no iOS project); interpolated font weights (Option C in research R7 — rejected for this feature).

## 5. Verification

Each gate has an **authored-in** unit (when the test is written) and an **enforced-from** unit (the first unit in which it can legitimately pass). Revision 2 conflated these and pinned O1/O2 to units where the code they check had not been written yet.

| # | Check | Authored in | Enforced from | Why the gap |
|---|---|---|---|---|
| G1 | `theme/brand.spec` — only `primary` differs across resolved themes | WU2 | WU2 | — |
| G2 | `theme/contrast.spec` — espresso-on-brand per swatch; a failing colour warns + falls back; **a passing colour is accepted** | WU2 | WU2 | — |
| G3 | `theme/fonts.spec` — every token's family is bundled; **no `fontWeight` anywhere in `src/`** | WU2 | **WU8** | 19 `font-*` classes live in components (WU3) and screens (WU4/6/8) |
| G4 | `theme/contrast.spec` — all 7 accent pairs | WU2 | WU2 | — |
| G5 | `theme/tokens.spec` — `tokens.ts` deep-equals `tokens.raw.js` | WU2 | WU2 | — |
| G6 | `theme/statusColors.spec` — unknown status → `neutral` + raw label | WU2 | WU2 | — |
| **G7** | **`theme/classnames.spec`** — see enumeration method below | WU2 | **WU8** | off-palette classes span components and screens |
| O1 | `theme/token-discipline.spec` — no raw literal; palette allow-list | WU2 | **WU8** | one hex literal is in `FeedbackScreen.tsx:167`, a WU4 file |
| O2 | `theme/surface.spec` — every screen declares a surface | WU3 | **WU8** | screens declare surfaces across WU4/6/8 |
| O3 | `theme/statusColors.spec` — no screen imports `accents` directly | WU2 | WU6 | — |
| O4 | `theme/touch-targets.spec` — AST scan of `h-`/`min-h-`/`height` on pressables | WU3 | WU3 | asserts over code, not over a markdown table |

**Nine spec files** (G2/G4 share `contrast.spec`; G6/O3 share `statusColors.spec`).

**Between authored-in and enforced-from, a gate is expected to report failures.** Each is wired as a reported-but-non-blocking check until its enforced-from unit, then becomes blocking. Without this, WU2 and WU3 would have to commit a red suite — which orchestrated execution forbids.

### G7 enumeration method (previously unspecified)

`resolveConfig(...).theme` reflects **`theme` only, not `plugins`** — so it would report the seven plugin-emitted text utilities as missing and fail on 154 call sites. The check must therefore:

1. **Enumerate** by having the text-style plugin export its utility key list for the test to `require`, unioned with `resolveConfig(...).theme` for colours, radii and spacing.
2. **Extract** class names handling all three forms present in the code: static `className="…"`; ternaries and template literals (`RowActionButton.tsx:39,45`, `CategoryChip.tsx:21`, `Dropdown.tsx:41,61`); and a class held in a variable (`PrimaryButton.tsx:32`). A regex over `className="…"` alone is insufficient — use an AST walk over JSX string literals.
3. **Normalise** opacity modifiers before lookup (`ProductCard.tsx:38` `bg-text-primary/70`, plus `bg-surface/20`, `bg-black/40`).
4. **Allow-list**, not existence-check: a class resolving to Tailwind's default palette (`text-red-600`) must FAIL, even though it resolves fine.

## 6. Known defect in the upstream design

`#E4572E`, offered as a tenant swatch in the canvas's `data-props`, scores **4.42:1** against espresso as a fill and **3.50:1** as a foreground — failing both legs of G2. Report to the designer. **Not a gate on this feature's completion.**
