# Phase 1 Data Model: Design Token Architecture

**Feature**: 017-ui-refresh | **Date**: 2026-11-06 | **Revision**: 2 (post review gate)

This feature introduces no database entities and no API types. Its "data model" is the **design token set**. Values are measured from the 27 artboards (see [research.md](./research.md)).

> **Revision 2 changes**: typography carries **no numeric weight** (R7 — weight lives in the family name); the class-name mapping layer is now first-class (R11); the contrast gate is **additive** (R8); all touch targets raised to 44 (review finding); `#6EE7B7` named; aliasing rule added (R14).

---

## 1. Token source and the class layer

Two distinct surfaces consume tokens, and **the class layer is the larger one** (R11):

| Surface | Consumers | Risk if changed carelessly |
|---|---|---|
| TS module `src/theme/tokens` | **13** files (none import `typography` or `radius`) | Compile error — loud, safe |
| Utility class names | **~355** usages (172 typography, 126 colour, 57 radius) | **Silent** — NativeWind drops unknown classes |

```
mobile/src/theme/
  tokens.raw.js     NEW — plain CommonJS, single source of raw values
  tokens.ts         typed re-export (public import surface; export shape preserved)
  accents.ts        NEW — accent-pair lookups
  statusColors.ts   REWRITTEN on accents.ts
mobile/tailwind.config.js   requires tokens.raw.js; hosts the class-mapping layer
```

### 1.1 Class-name compatibility (binding)

The seven existing class names are a **stable interface**. They keep their names and are remapped to new values, so no call site changes:

| Existing class | Uses | New meaning |
|---|---|---|
| `text-h1` | 5 | `display` — Bricolage 34 |
| `text-h2` | 12 | `subtitle` — Bricolage 20 |
| `text-body` | 84 | `body` — Inter-Medium 15 |
| `text-body-bold` | 18 | `bodyBold` — Inter-Bold 15 |
| `text-price` | 7 | `price` — Inter-Bold 16 |
| `text-caption` | 36 | `caption` — Inter-Medium 12 |
| `text-button` | 10 | `labelLg` — Inter-SemiBold 14 |
| `rounded-sm` / `md` / `lg` / `pill` | 2 / 6 / 31 / 16 | 10 / 12 / 14 / 999 — **`sm` and `lg` change meaning silently; recorded in SC-004** |
| `rounded-full` | 2 | **not in the scale** — migrate to `rounded-pill` |

New styles are added under new names alongside these. **No existing class name may be deleted** without migrating every call site in the same work unit.

### 1.2 TypeScript re-export (typing hazard)

A naive re-export of `tokens.raw.js` **fails typecheck**: string literals widen to `string`, which is not assignable to `TypographyStyle['fontWeight']` or RN's `TextStyle`. `tokens.raw.js` must carry JSDoc `@type` annotations, or `tokens.ts` must apply an explicit cast layer. A cast weakens G5's deep-equal guarantee to a runtime check — state which is used.

`tokens.ts` MUST keep exporting `colors`, `typography`, `spacing`, `radius`, `tokens`, with `ColorTokens.primary` typed as `string`.

---

## 2. Colour

### 2.1 Core

| Token | Value | Role | Changed from |
|---|---|---|---|
| `primary` | `#FF6B35` | Brand. **Only tenant-overridable token.** | unchanged |
| `primaryVariant` | `#183153` | Back-of-house chrome | unchanged |
| `espresso` | `#2B1D16` | Primary text **and** primary action fill | **new** |
| `background` | `#FFF8F1` | Student ground | was `#FFF7ED` |
| `backgroundAlt` | `#F5F3EF` | Back-of-house ground | **new** (R1) |
| `surface` | `#FFFFFF` | Cards, inputs | unchanged |
| `accent` | `#FFC857` | Highlights | unchanged |
| `secondary` | `#0B7A55` | Veg mark | was `#0E9F6E` |
| `textPrimary` | → `espresso` | alias | was `#1F2937` |
| `textBody` | `#4A4756` | Body copy | **new** |
| `textSecondary` | `#5B5866` | Captions, meta | was `#6B7280` |
| `textOnDark` | `#D6D4DD` | Text on espresso | **new** |
| `link` | `#B23C0E` | Links and brand-coloured text | **new** |
| `border` | `#F1E6DA` | Card hairline | was `#E5E7EB` |
| `borderSoft` | `#EFE3D6` | Chip / round-button border | **new** |
| `borderDashed` | `#CFC6BB` | Disabled / read-only outline | **new** |
| `disabledFill` | `#F4EEE7` | Disabled / read-only fill | **new** |
| `disabledText` | `#6E6A78` | Disabled label | **new** |
| `nonVeg` | `#9A3412` | Non-veg mark | **new** |

### 2.2 Accent pairs (R4)

One family, three consumers — status chips, icon tiles, product tints. Each `{ soft, strong, dot?, glyph? }`.

| Key | `soft` | `strong` | `dot` | Contrast | Consumers |
|---|---|---|---|---|---|
| `tangerine` | `#FFE6DA` | `#B23C0E` | `#FF6B35` | 4.96:1 | `order_placed` · tile · tint |
| `sun` | `#FFF1D6` | `#8A5300` | `#F59E0B` | 5.67:1 | `payment_pending` · tile · tint |
| `mint` | `#DDF4EA` | `#0B6B4B` | `#16A34A` | 5.65:1 | `delivered` · tile · tint · `glyph #6EE7B7` |
| `red` | `#FDE2E1` | `#B42318` | `#DC2626` | 5.37:1 | `payment_failed` |
| `violet` | `#EDE7FB` | `#4C2E91` | — | 8.27:1 | tile · tint |
| `blue` | `#E4ECF7` | `#183153` | — | 11.00:1 | tile · back-of-house accent |
| `neutral` | `#ECE8E3` | `#183153` | — | — | tile · tint |

**Status mapping**: `payment_pending→sun`, `order_placed→tangerine`, `payment_failed→red`, `delivered→mint`. Unmapped status → `neutral` with its raw label, never blank.

**Product tint rotation**: `[tangerine, sun, mint, violet, neutral].soft`, chosen deterministically by product id.

**Reconciliation rule (R13)**: a tonal sibling met in an artboard joins its owning family as a named step. It is never inlined as a loose hex.

**Aliasing rule (R14)**: each distinct value is one constant in `tokens.raw.js`. `link` and `tangerine.strong` both reference the same `#B23C0E`; `primaryVariant`, `blue.strong` and `neutral.strong` share `#183153`.

---

## 3. Typography — families carry weight, styles carry NO weight (R7)

**Binding rule**: no style below sets `fontWeight`. A bundled family plus a numeric weight ≥700 silently renders in the system font.

**Bundled faces**: `BricolageGrotesque-ExtraBold`, `Inter-Medium`, `Inter-SemiBold`, `Inter-Bold`, `Inter-ExtraBold` — static `.ttf`, one per weight. Both families OFL; licence text ships with the app.

| Token | Family | Size | Line height | Tracking | Use |
|---|---|---|---|---|---|
| `hero` | BricolageGrotesque-ExtraBold | 48 | 52 | -1.5 | Pickup digits (OrderSuccess 36) |
| `display` | BricolageGrotesque-ExtraBold | 34 | 38 | -1.2 | Screen hero · **`text-h1`** |
| `title` | BricolageGrotesque-ExtraBold | 28 | 32 | -0.8 | Screen title |
| `titleSm` | BricolageGrotesque-ExtraBold | 24 | 28 | -0.5 | Section title |
| `subtitle` | BricolageGrotesque-ExtraBold | 20 | 24 | -0.3 | Card title · **`text-h2`** |
| `subtitleSm` | BricolageGrotesque-ExtraBold | 17 | 22 | 0 | Dense card title |
| `price` | Inter-Bold | 16 | 22 | 0 | Price · **`text-price`** |
| `bodyLg` | Inter-Medium | 16 | 22 | 0 | Input text |
| `body` | Inter-Medium | 15 | 21 | 0 | **Default** · **`text-body`** |
| `bodyBold` | Inter-Bold | 15 | 21 | 0 | **`text-body-bold`** |
| `labelLg` | Inter-SemiBold | 14 | 20 | 0 | Field label · **`text-button`** |
| `label` | Inter-SemiBold | 13 | 18 | 0 | Small label — 3rd most-used style |
| `eyebrow` | Inter-Bold | 12 | 16 | 1.5 | Uppercase section label |
| `caption` | Inter-Medium | 12 | 16 | 0 | Meta · **`text-caption`** |
| `captionSm` | Inter-SemiBold | 11 | 14 | 0.8 | Dense meta |

**Emission**: Tailwind's `fontSize` tuple cannot carry `fontFamily`. Each style is emitted as a **single utility** carrying family + size + line-height + tracking, via a `tailwind.config.js` plugin. **This must be proven in WU2**; if the plugin does not survive NativeWind 4 compilation, the fallback is a paired-class convention (`text-body font-body`) and WU4–WU8 expand to add a family class to ~172 text nodes.

---

## 4. Radius (R3)

| Token | Value | Use |
|---|---|---|
| `glyph` | 3 | Dietary mark |
| `xs` | 8 | Sold-out stamp |
| `sm` | 10 | Pickup-code cell — **was 4** |
| `md` | 12 | Small icon tile |
| `lg` | 14 | Input, icon tile — **was 20**, 31 call sites |
| `xl` | 16 | Toast, list row |
| `2xl` | 18 | Product image |
| `3xl` | 20 | Panel |
| `4xl` | 22 | Pickup-code panel |
| `5xl` | 24 | Card |
| `6xl` | 28 | Large card |
| `pill` | 999 | Buttons, chips, steppers |

One-offs 9, 26, 30, 32 snap to the nearest step (≤2px). `rounded-full` (2 uses) migrates to `rounded-pill`.

---

## 5. Spacing

Unchanged: `xs 4`, `sm 8`, `md 16`, `lg 24`, `xl 32`. Add intermediate steps only where a screen demonstrably needs one.

---

## 6. Component contracts

**Every interactive element is ≥44×44**, overriding the artboards where they show less (FR-015, SC-006, O4). The artboards draw an ADD control at 40 and stepper segments at 34×40; the accessibility floor wins.

| Component | Height | Radius | Fill | Text | Notes |
|---|---|---|---|---|---|
| Primary button | 52 | pill | `espresso` | `surface`, `labelLg` | |
| Brand button | 52 | pill | `primary` | `espresso`, `labelLg` | Subject to the gate |
| Disabled button | 52 | pill | `disabledFill` | `disabledText` | 1.5 **dashed** — shape differs, not just colour |
| ADD control | **44** | pill | `primary` | `espresso`, `label` | Artboard 40 → raised |
| Quantity stepper | **44** | pill | `espresso` | `surface` | Each −/+ **44×44**; artboard 34×40 → raised |
| Status chip | — | pill | `accent.soft` | `accent.strong`, `eyebrow` | 7px `accent.dot` |
| Icon tile | 44 | `md`/`lg` | `accent.soft` | `accent.strong` | |
| Input | 48 | `lg` | `surface` | `espresso`, `bodyLg` | 1.5 solid `espresso` |
| Read-only input | 48 | `lg` | `disabledFill` | `textSecondary` | 1.5 **dashed** |
| Toast | — | `xl` | `espresso` | `surface`, `label` | `accents.mint.glyph` check |
| Pickup-code cell | 44 | `sm` | `primary` | `espresso`, `hero`/`display` | Six cells |
| Product card | — | `5xl` | `surface` | — | 1px `border`; image `2xl` |
| Sold-out stamp | — | `xs` | `surface` | `espresso`, `label` | 2px border, rotated −8° |

---

## 7. Tenant override — the gate is ADDITIVE (R8)

Mechanism unchanged: `primary` is the only overridable token (`resolveBrandTheme.ts`), and a failing colour **warns and falls back to the default** — it does not fail the build.

The gate keeps **both** legs:
1. **Brand as fill** — espresso text on brand ≥4.5:1 *(replaces the current white-on-brand leg)*
2. **Brand as foreground** — brand on each ground ≥4.5:1 *(retained; dropping it would delete a real check)*

Measured:

| Swatch | As fill (espresso) | As foreground (cream) | Verdict |
|---|---|---|---|
| `#FFB020` | 8.90 | **1.74** | fails foreground |
| `#F97316` | 5.81 | **2.66** | fails foreground |
| `#FF6B35` (default) | 5.74 | **2.69** | fails foreground |
| `#E4572E` | **4.42** | 3.50 | fails both |

**No swatch passes as a foreground.** The design resolves this by never using brand as text — links use `link #B23C0E` (5.63 on cream), controls use `espresso`. The **8 existing brand-as-foreground sites** (`ContactUsScreen:71,78`, `CartScreen:153,157`, `OrderDetailScreen:154`, `FeedbackListScreen:132`, `PasswordInput:37`, `RowActionButton:45`) migrate to `link`/`espresso` during WU4–WU8. Until they do, the foreground leg is advisory; afterwards it guards against regression.

`#E4572E` is reported to the designer as a defect in the canvas. It is **not** a gate on this feature.

---

## 8. State transitions

None. No state is introduced or changed (FR-024 … FR-028).
