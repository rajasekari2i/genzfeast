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
| **G2** | A tenant `primary` failing 4.5:1 in **either** role — as a fill behind text, or as a foreground on a ground — is rejected: the system warns and falls back to the default. It does not fail the build. |
| **G3** | Every typography token resolves to a bundled font file, and **no typography token sets a numeric font weight**. |
| **G4** | Every accent pair satisfies 4.5:1 (`strong` on `soft`). |
| **G5** | `tokens.ts` and `tailwind.config.js` cannot disagree: both derive from `tokens.raw.js`. |
| **G6** | An order status with no accent mapping renders with the `neutral` pair and its raw label. Never blank. |
| **G7** | **Every utility class name used anywhere in `src/` resolves to a definition in the generated theme.** A class that silently stops applying is a breaking change. |

## 3. Obligations on consumers

| # | Obligation |
|---|---|
| **O1** | No raw colour, radius or font size/weight literal in a screen or component for anything the tokens define. |
| **O2** | Surface choice is explicit: student screens use `background`, back-of-house use `backgroundAlt`. No screen hardcodes either. |
| **O3** | Status presentation goes through `statusColors.ts`. No screen maps a status to a colour itself. |
| **O4** | Interactive elements present ≥44×44 touch targets, even where an artboard shows less. |

## 4. Non-goals

Dark mode; runtime theming; per-tenant typography, spacing or radius; iOS font registration (no iOS project); interpolated font weights (Option C in research R7 — rejected for this feature).

## 5. Verification — every guarantee and obligation has a named check

| # | Check | Type | Runs in |
|---|---|---|---|
| G1 | `theme/brand.spec` — only `primary` differs across resolved themes | automated | WU2 |
| G2 | `theme/contrast.spec` — espresso-on-brand **and** brand-on-ground, for each swatch plus a known-failing colour; asserts warn + fallback, not throw | automated | WU2 |
| G3 | `theme/fonts.spec` — every typography token's family is in the bundled list **and** no token carries `fontWeight` | automated | WU2 |
| G4 | `theme/contrast.spec` — all 7 accent pairs | automated | WU2 |
| G5 | `theme/tokens.spec` — `tokens.ts` deep-equals `tokens.raw.js` | automated | WU2 |
| G6 | `theme/statusColors.spec` — unknown status → `neutral` + raw label | automated | WU2 |
| **G7** | **`theme/classnames.spec` — scan `src/**` for `text-*`/`bg-*`/`border-*`/`rounded-*` absent from the generated theme** | automated | **WU2** |
| O1 | `theme/token-discipline.spec` — no raw hex / radius / size literal in `src/screens`, `src/components` | automated | WU2 |
| O2 | `theme/surface.spec` — no screen uses a ground literal; each screen declares its surface | automated | WU3 |
| O3 | `theme/statusColors.spec` — no screen imports `accents` directly | automated | WU3 |
| O4 | `theme/touch-targets.spec` — every component contract entry ≥44; plus the per-component review rows in `quickstart.md` | automated + review | WU3 |

**Nine automated gates**, all authored in WU2/WU3 — not deferred to the end, because G7 and G3 are the two that catch silent failures.

## 6. Known defect in the upstream design

`#E4572E`, offered as a tenant swatch in the canvas's `data-props`, scores **4.42:1** against espresso as a fill and **3.50:1** as a foreground — failing both legs of G2. Report to the designer. **Not a gate on this feature's completion.**
