# Phase 0 Research: Mobile App UI Refresh

**Feature**: 017-ui-refresh | **Date**: 2026-11-06
**Method**: All 27 artboards of canvas `FR5PwC3QVTEh3H6cWUNPnT` (version `1793942825-6895`) were downloaded and analysed mechanically — colour, radius, type-size and weight inventories extracted across every board, then cross-checked against `mobile/src/theme/tokens.ts`, `mobile/tailwind.config.js` and the API DTOs.

> **Headline**: the artboards are implementable, but Phase 0 found **eight statements in `spec.md` that needed correcting** (all now applied), **one defect in the design itself** (a sanctioned tenant swatch that fails the design's own contrast rule), and — most consequentially — **one error in this document's own first draft**: R7's account of Android font resolution was wrong in a way that would have silently rendered every heading in the system font. R11 then established that this feature's real surface is utility class names, not the TypeScript token module, which reframes the whole migration.
>
> Findings R1–R10 are from the original measurement pass. **R7 and R8 were rewritten** after verification against platform source and computed contrast. **R11–R14 were added** after adversarial review.

---

## R1 — The app has TWO grounds, not one *(spec defect: FR-003)*

**Finding**: Root background by board splits cleanly along role lines.

| Ground | Boards | Screens |
|---|---|---|
| Cream `#FFF8F1` | 10 | Login, Register, Home, Drawer, Cart, OrderDetail, MyOrders, Profile, Feedback, ContactUs |
| Warm grey `#F5F3EF` | 14 | Dashboard, AdminProducts, StaffProducts, Categories, CategoryForm, Departments, DepartmentForm, Users, UserForm, IncomingOrders, Fulfilment, FeedbackReview, FeedbackDetail, AdminDrawer, StaffDrawer |
| Brand (full bleed) | 1 | OrderSuccess (see R5) |

Navy `#183153` appears on **only** the 14 back-of-house boards, confirming the split is deliberate: students get warm cream, staff and admins get a cooler, flatter working surface.

**Decision**: Define two ground tokens — `background` (cream `#FFF8F1`, student) and `backgroundAlt` (`#F5F3EF`, back-of-house). Screens select by role surface, not ad hoc.

**Spec correction**: FR-003 says cream is "the app ground" (singular). It must name both.

**Alternatives rejected**: One ground everywhere — contradicts 14 of 26 artboards and erases an intentional role signal.

---

## R2 — The type scale in the spec does not match the screens *(spec defect: FR-007)*

**Finding**: Measured across all boards.

Bricolage Grotesque — **always weight 800**, never 500–700. Sizes: 17, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 40, 48. Most common: 26, 28, 24, 22.

Inter — weights 500 (21), 600 (76), 700 (63), 800 (52); **weight 400 appears 3 times in 27 boards**. Sizes 11–17. Most common pairings: `15/500` (body), `13/600` (small label), `16/700` (price/emphasis), `12/700` (eyebrow).

**What FR-007 claims vs reality**:

| FR-007 says | Reality |
|---|---|
| display 34 / **800** | correct weight, but 26–28 is the common screen title; 34–48 is reserved for hero numbers |
| title 22 / **700** | Bricolage is **800**, never 700 |
| price & labels 16 / **600** | `16/700` |
| body 14 / **400** | `15/500` — weight 400 is effectively unused |
| *(absent)* | `13/600` small label is the **third most common style in the system** and is missing entirely |

**Decision**: Adopt the measured scale — `display` (Bricolage 800, sizes 20/24/28/34/40/48), `title` (Bricolage 800 @ 17–22), `body` (Inter 500 @ 15), `label` (Inter 600 @ 13), `labelLg` (Inter 600/700 @ 14–16), `price` (Inter 700 @ 16), `eyebrow` (Inter 700 @ 12, 1.5px tracking, uppercase), `caption` (Inter 500 @ 11–12).

**Spec correction**: FR-007 must be replaced wholesale.

**Alternatives rejected**: Keeping the Foundations strip's values — it is a *sample* of the two typefaces, not a specification of screen usage; implementing it would make every screen subtly wrong.

---

## R3 — The radius scale is incomplete *(spec defect: FR-008)*

**Finding**: Radii actually used, by frequency — `999/50%` (124), `14` (53), `16` (29), `24` (22), `18` (14), `22` (13), `12` (12), `10` (12), `3` (8), `28` (5), `20` (5), `26` (3), `32` (2), `30` (2), `9` (1), `8` (1).

FR-008 lists 10, 14, 16, 18, 22, 24, 28, pill. It **omits `12`** (12 uses), **`20`** (5 uses) and **`3`** (8 uses — the veg/non-veg dietary glyph, a load-bearing detail).

**Decision**: Scale of eleven — `glyph 3`, `xs 8`, `sm 10`, `md 12`, `lg 14`, `xl 16`, `2xl 18`, `3xl 20`, `4xl 22`, `5xl 24`, `6xl 28`, `pill 999`. The five remaining one-offs (9, 26, 30, 32) snap to their nearest step; none is load-bearing and the largest deviation is 2px.

**Spec correction**: FR-008 must list the full scale.

---

## R4 — Chips, icon tiles and product tints share ONE accent family *(architecture)*

**Finding**: The 61 distinct hex values collapse into a small, repeating structure. The same soft background / strong foreground pairs appear in three different roles:

| Family | Soft bg | Strong fg | Dot | Used as |
|---|---|---|---|---|
| Tangerine | `#FFE6DA` | `#B23C0E` | `#FF6B35` | `order_placed` chip · icon tile · product tint |
| Sun | `#FFF1D6` | `#8A5300` | `#F59E0B` | `payment_pending` chip · icon tile · product tint |
| Mint | `#DDF4EA` / `#E6F3EC` | `#0B6B4B` | `#16A34A` | `delivered` chip · icon tile · product tint |
| Red | `#FDE2E1` / `#FBF1EF` | `#B42318` / `#7A1A12` | `#DC2626` | `payment_failed` chip |
| Violet | `#EDE7FB` | `#4C2E91` | — | icon tile · product tint |
| Blue | `#E4ECF7` / `#DCE5F1` | `#183153` / `#23426B` | — | icon tile · back-of-house accents |
| Neutral | `#F4F1EC` / `#ECE8E3` | `#183153` | — | icon tile · product tint |

Product-image placeholder tints rotate through `#FFE6DA`, `#FFF1D6`, `#E6F3EC`, `#EDE7FB`, `#ECE8E3` — the same soft backgrounds.

**Decision**: Model this as a single `accents` token group of `{soft, strong, dot?}` triplets, consumed by the status chip, the icon tile and the product-tint rotation alike. Defining them three times would guarantee drift.

**Alternatives rejected**: 61 flat named colours — unmaintainable and hides the structure that makes the design coherent.

---

## R5 — OrderSuccess is a full-bleed BRAND screen *(scope sharpening)*

**Finding**: `OrderSuccess` is the only board whose root background is `{{brand}}` — the entire screen is the tenant brand colour, with the pickup code at **36px Bricolage 800** (not the 24px shown on the Foundations board).

**Decision**: The spec's assumption stands structurally — no new screen or route is created; this is the `order_placed` state of the existing order-detail screen. But the visual delta is larger than "a state": that state renders full-bleed brand while every sibling state stays cream. Treat it as its own work unit.

**Consequence for R8**: this screen puts espresso text directly on a full-bleed brand background at display size, which makes the contrast gate materially more important than if brand were confined to buttons.

---

## R6 — The Register artboard omits a required field *(implementation constraint)*

**Finding**: Cross-checking every form artboard against the API DTOs:

- **Register** shows: Full name · Mobile number (with a "Verified" badge) · Password · "I am a…" (= `category_id`: Student / Teaching Staff / Non-Teaching Staff) · Department (optional) · Email. It does **not** show **`gender`**, which `RegisterStudentDto` requires (`male | female | transgender`).
- **UserForm** is complete — it carries both Gender (Female/Male/Transgender) and Role (Staff/Student/Teaching/Non-teaching).

**Decision**: Per the spec's standing assumption (artboards govern appearance, the shipped app governs behaviour), the Register screen keeps its gender control and renders it in the new language, styled to match the artboard's own "I am a…" segmented-chip pattern. Implementing Register literally from the artboard would break registration.

**Alternatives rejected**: Dropping `gender` to match the artboard — a server-side `400` on every registration.

---

## R7 — How Android actually resolves a bundled font *(CORRECTED — the first version of this finding was wrong)*

> **This finding originally stated that Android resolves fonts by PostScript name. That is false.** Verified against `mobile/node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/common/assets/ReactFontManager.kt`.

**The mechanism** (`ReactFontManager.kt:162,164,176-187`):

```kotlin
private val EXTENSIONS = arrayOf("", "_bold", "_italic", "_bold_italic")
private const val FONTS_ASSET_PATH = "fonts/"
...
val extension = EXTENSIONS[style]
val fileName = "$FONTS_ASSET_PATH$fontFamilyName$extension$fileExtension"
try { return Typeface.createFromAsset(assetManager, fileName) }
catch (e: RuntimeException) { continue }
...
return Typeface.create(fontFamilyName, style)   // silent system fallback
```

Resolution is by **asset file name**, and only four suffixes exist. `nearestStyle` (`:138-144`) collapses any numeric weight to one of them, with `BOLD = 700` (`:154`):

```kotlin
get() = if (weight < BOLD) { if (italic) ITALIC else NORMAL }
        else                { if (italic) BOLD_ITALIC else BOLD }
```

**The failure, traced for our own tokens.** `{ fontFamily: 'Inter-Bold', fontWeight: '700' }` → `nearestStyle` = `BOLD` → `EXTENSIONS[1]` = `"_bold"` → seeks `fonts/Inter-Bold_bold.ttf` → absent → `:187` returns the **default system typeface**, synthetically bolded. No exception, no warning.

Applied across the measured scale:

| Weight | `nearestStyle` | File sought | Outcome |
|---|---|---|---|
| 500 — `body`, `bodyLg` | NORMAL | `Inter-Medium.ttf` | resolves |
| 600 — `label`, `labelLg` | NORMAL | `Inter-SemiBold.ttf` | resolves |
| 700 — `price`, `eyebrow`, `bodyBold` | **BOLD** | `Inter-Bold_bold.ttf` | **system font** |
| 800 — **all six Bricolage styles** | **BOLD** | `BricolageGrotesque-ExtraBold_bold.ttf` | **system font** |

So everything below 700 resolves by accident and everything at 700+ fails silently: body text correctly typeset, **every heading in the system face**. That reads as "the display font looks a bit off", not as a resolution bug — the most expensive kind of defect to find late.

It also invalidated this feature's original verification step ("a deliberate wrong family name visibly falls back"): a *correct* name at weight 800 falls back identically, so the negative control could not distinguish success from failure.

**Options considered**

- **A — `_bold` suffix convention.** `Inter.ttf` + `Inter_bold.ttf`, using `fontFamily` + `fontWeight`. **Rejected**: each family gets only two weights. Inter needs 500/600/700/800; 500 and 600 would collapse to one file and 700/800 to another. Cannot express the design.
- **B — one family per weight, never set a numeric weight. ← CHOSEN.** `fontFamily: 'Inter-SemiBold'` with no `fontWeight` → `nearestStyle` returns NORMAL → suffix `""` → `fonts/Inter-SemiBold.ttf` resolves. Works for all five faces.
- **C — `addCustomFont` + `res/font` XML** (`:79-88`). True weight interpolation via `Typeface.create(typeface, weight, italic)` (`:150`) — but only on API 28+; `:148` collapses to the same four styles below that. Requires native Kotlin in `MainApplication` plus XML font-family resources. **Rejected for this feature**: more native surface than a restyle warrants, and its benefit (interpolated weights) is not something the design asks for — it uses five discrete faces.

**Decision — Option B, with three consequences:**

1. **No text style may set a numeric font weight.** Weight is carried by the family name. This is now spec **FR-007a**.
2. `tailwind.config.js:25-31` currently bakes `fontWeight` into every `fontSize` tuple. Every one must lose it, or the bug returns through the class layer.
3. Verification must render **one sample per face**, with the 700/800 faces as the meaningful check, since those are the ones that fail silently.

**Faces required**: `BricolageGrotesque-ExtraBold.ttf`; `Inter-Medium.ttf`, `Inter-SemiBold.ttf`, `Inter-Bold.ttf`, `Inter-ExtraBold.ttf`. Both families are OFL — the licence text must ship with the app.

**Tooling**: `react-native-asset` is **not** currently a dependency (`mobile/package.json`), and `@react-native-community/cli@20` no longer provides `link`. It must be pinned in `devDependencies` with an npm script rather than invoked through an unpinned `npx` fetch in the build path. This contradicts the earlier claim that the feature "introduces no new dependency beyond font files" — it introduces one, deliberately.

## R8 — The contrast gate must check ONE pairing. Checking two rejects every colour that exists.

**Finding 1 — a sanctioned swatch fails as a fill.** Espresso `#2B1D16` on each swatch: `#FFB020` **8.90**, `#F97316` **5.81**, `#FF6B35` **5.74**, `#E4572E` **4.42** — the last fails 4.5:1.

**Finding 2 — the shipped gate ANDs two legs** (`resolveBrandTheme.ts:76-81`):

```ts
const legibleAsForeground = meetsAAContrast(config.accentColor, [background, surface]);
const legibleAsButtonFill = meetsAAContrast('#FFFFFF', [config.accentColor]);
const accentPasses = legibleAsForeground && legibleAsButtonFill;
```

Revision 2 kept leg 1 and swapped leg 2's white for espresso. **That combination is unsatisfiable.** Solving both constraints with the project's own formula (`contrastCheck.ts:28-40`):

| Constraint | Requirement on the brand's relative luminance |
|---|---|
| espresso-on-brand ≥ 4.5 | `L ≥ 0.2403` |
| brand-on-cream `#FFF8F1` ≥ 4.5 | `L ≤ 0.1717` |
| brand-on-warm-grey `#F5F3EF` ≥ 4.5 | `L ≤ 0.1605` |
| brand-on-white ≥ 4.5 | `L ≤ 0.1833` |

**`L ≥ 0.2403` AND `L ≤ 0.1717` — the feasible set is empty.** Not "no sanctioned swatch passes": *no colour in the sRGB gamut passes*. A brand must be light enough to carry espresso text and dark enough to read on cream; those are opposite requirements. The existing test fixture `#004D40` scores 1.66 against espresso and would also be rejected.

Worse, the failure is invisible to the gate's own test: `contrast.spec` asserts that failures warn and fall back, which they would — for every colour. FR-009 ("tangerine is the only value a canteen can override") would be unimplementable while every check passed.

**Finding 3 — brand-as-foreground fails today anyway.** No swatch reaches 4.5:1 as a foreground (best `#E4572E` at 3.50; the default `#FF6B35` at 2.69). The app has 8 such sites: `ContactUsScreen:71,78`, `CartScreen:153,157`, `OrderDetailScreen:154`, `FeedbackListScreen:132`, `PasswordInput:37`, `RowActionButton:45`.

**Decision — check the fill pairing only.** *(User decision, 2026-11-06.)*

1. The gate evaluates **espresso on brand ≥ 4.5:1**, and nothing else. It warns and falls back; it does not fail the build.
2. **The brand-as-foreground leg is deleted**, because the redesign never uses brand as text — links use `link #B23C0E` (**5.63** on cream, **5.34** on warm grey, **5.92** on white) and controls use espresso. The 8 existing sites migrate during WU4–WU8, after which the leg would guard a usage that no longer exists.
3. The migration of those 8 sites is therefore a **prerequisite for deleting the leg honestly**, not an optional tidy-up. Until they are migrated the app has 8 sub-AA text sites — a pre-existing defect this feature fixes rather than introduces.
4. `#E4572E` is reported to the designer. **Not a gate on this feature.**
5. `resolveBrandTheme.spec.ts:19`'s `#004D40` fixture must be re-derived to a colour that passes, and a test added asserting a non-default override is **accepted** — otherwise nothing proves the override path still works.

**Alternatives rejected**: keeping both legs (provably empty); foreground leg warn-only (a warning nobody acts on, while the code still carries a check the design contradicts); foreground leg at 3:1 (feasible set `L` 0.2403–0.3659, but it would reject the shipped default `#FF6B35`).

**Note — the resolver is dormant.** `resolveBrandTheme` has **no production call site**; only its own test imports it. So US1 Acceptance Scenario 2 is not demonstrable in the running app today, and wiring it up would be new non-visual behaviour outside this feature. This feature corrects the gate's logic; it does not activate it.

## R9 — One token source, not two *(technical debt this feature should not double)*

**Finding**: `tailwind.config.js` hand-duplicates every value from `tokens.ts`, with a comment explaining why: the config is loaded by Node/PostCSS without a TypeScript loader. Today that is ~9 colours and 4 radii. After this feature it would be ~30 named colours, 7 accent triplets, 11 radii and 8 text styles — **duplicated by hand, in two files, with no check that they agree**.

**Decision**: Extract the raw values into a plain `mobile/src/theme/tokens.js` (or `.json`) that **both** `tokens.ts` (typed re-export) and `tailwind.config.js` (`require`) consume. No build step, no TypeScript loader, one source of truth. This is a small refactor that removes the duplication rather than tripling it.

**Alternatives rejected**: Continuing to hand-sync (near-certain drift at this size); a codegen step (new build machinery for a problem a shared `.js` file solves).

---

## R10 — Verifying artboard fidelity without visual-regression tooling

**Finding**: The project has no snapshot or visual-regression tooling. `mobile/test/` contains only `theme/` tests.

**Decision**: Three complementary gates, none of which claims to be a pixel diff:
1. **Automated token-discipline check** — a test asserting no screen or component contains a raw hex literal or a raw radius/size for anything the tokens define. This is objectively checkable and directly enforces SC-004.
2. **Automated contrast test** — assert every foreground/background token pairing in use meets 4.5:1 (3:1 for large text), enforcing SC-005.
3. **Structured human review** — a per-screen checklist in `quickstart.md`, each item naming its artboard, for SC-007.

**Alternatives rejected**: Introducing a screenshot-diff harness — real value, but it is new infrastructure and belongs in its own feature, not inside a 32-screen restyle.

---

## R11 — The real coupling is CLASS NAMES, not the token module *(the single most important finding)*

**Finding**: This feature was originally planned as a TypeScript module migration. That targets the wrong surface.

Measured imports of `src/theme/tokens`: **13 files**. Of those, **not one imports `typography` or `radius`**; a single file (`BrandRationaleSlider.tsx:3`) imports `spacing`. `colors` is the only group with real TS consumers.

Measured utility-class usage in `mobile/src` — the surface screens actually style through:

| Class | Uses | Fate under the new scale |
|---|---|---|
| `text-body` | **66** (84 matches include the 18 `text-body-bold`) | survives by name; 14/400 → 15/500 |
| `text-text-primary` | **68** | survives; `#1F2937` → `#2B1D16` |
| `text-text-secondary` | **58** | survives; `#6B7280` → `#5B5866` |
| `border-border` | **54** | survives; `#E5E7EB` → `#F1E6DA` |
| `text-caption` | **36** | survives; weight must be stripped (R7) |
| `rounded-lg` | **31** | survives by name; **20 → 14 silently** |
| `text-body-bold` | **18** | survives; weight stripped |
| `rounded-pill` | 16 | unchanged |
| `text-h2` | **12** | **key deleted by the new scale** |
| `text-button` | **10** | **key deleted** |
| `bg-surface` | 10 | unchanged |
| `text-price` | 7 | survives; weight stripped |
| `bg-background` | 7 | survives; must become surface-aware (R1) |
| `rounded-md` | 6 | unchanged (12) |
| `bg-primary` | 6 | unchanged |
| `text-h1` | **5** | **key deleted** |
| `rounded-sm` | 2 | **4 → 10 silently** |
| `rounded-full` | 2 | **not in the token scale at all** |

Roughly **172 typography**, **57 radius** and **126 colour** class usages — against 13 TS importers.

**Two class families revision 2 missed entirely**, both invisible to the gates as first specified:

| Family | Count | Files | Why it matters | Why no gate caught it |
|---|---|---|---|---|
| `font-bold` ×4, `font-semibold` ×15 | **19** | 14 | NativeWind compiles these to `fontWeight: 700/600`. At 700 this re-enters R7's silent system-font fallback — the feature's headline bug, through the class layer | `G3` inspects *typography tokens*; `G7`'s prefixes were `text-/bg-/border-/rounded-` only — `font-*` excluded |
| `text-red-600` ×29, `text-green-700` ×4, `text-slate-500`, `text-amber-700`, `border-green-600`, `border-amber-500`, `bg-green-50`, `bg-amber-50`, `border-red-600` | **46** | 22 | Stock Tailwind palette, not foundation colours. Nearly every validation message in the app is `text-red-600` `#DC2626` — which is `accents.red.dot`, not `accents.red.strong` `#B42318` | `O1` scans *hex literals*; `G7` passes anything present in Tailwind's default theme |

Also `src/theme/navigationHeader.ts:12,27` set `headerTitleStyle: { fontWeight: '700' }` — applied to **every stack header in the app**. If WU7 adds a bundled family beside it, every header title silently renders in the system face.

**Decision**: add both families to the migration map (§1.1), assign their call sites to the owning work units, widen `G3` to "no `fontWeight` anywhere in `src/`, as a style property or a `font-{weight}` class", and make `O1` a **palette allow-list** rather than a hex-literal scan.

**Why this is dangerous**: NativeWind **silently drops an unknown class**. Deleting `h1`/`h2`/`button` would leave 27 text nodes unstyled with no compile error, no build error, and no runtime warning. The original WU2 gate — *"typecheck passes and the app builds"* — cannot detect any of it, because `tsc` does not read `className` strings.

**Decision — three parts:**

1. **Keep the seven existing class names as a stable interface and remap their values.** `text-h1`, `text-h2`, `text-body`, `text-body-bold`, `text-price`, `text-caption`, `text-button` all survive, remapped to their nearest new style. This reduces the typography sweep from 172 call sites to zero. New styles are added alongside under new names for new usage.
2. **Emit each text style as a single utility carrying family + size + line-height + tracking and NO weight.** Tailwind's `fontSize` tuple cannot carry `fontFamily`, so a plain theme extension would force every text node to gain a second `font-*` class — ~172 extra edits. A small `tailwind.config.js` plugin using `addUtilities` emits one complete utility per style instead. **This must be proven before WU3**: if the plugin route does not survive NativeWind 4's compilation, the fallback is the paired-class convention (`text-body font-body`) and WU4–WU8 grow accordingly.
3. **Add a gate that fails on an unknown custom class.** Scan `src/**` for `text-*`, `bg-*`, `border-*` and `rounded-*` names not present in the generated theme. This is the check that would have caught the whole problem, and it must run **in WU2**, not at the end.

**Alternatives rejected**: renaming classes to match new token keys (172 mechanical edits for no user-visible gain, each a chance to typo a class that then silently does nothing); leaving `rounded-lg`/`rounded-sm` to change meaning silently (acceptable for a restyle, but only if stated — now recorded in spec SC-004).

---

## R12 — HomeScreen has no virtualisation to preserve

**Finding**: The plan claimed the two-column grid "must preserve list virtualisation". `HomeScreen.tsx:60,72` is already a `.map()` over products inside `<Screen>`, and `Screen.tsx:47` wraps children in a plain `ScrollView`. There is no `FlatList` on this screen — `FlatList` appears only in `CategoryListScreen`, `FeedbackListScreen`, `ProductListScreen` and `DepartmentListScreen`.

Consequently `numColumns` is not currently reachable: nesting a `FlatList` inside `Screen`'s `ScrollView` is the same-orientation VirtualizedList anti-pattern that `Screen.tsx:28-36` already documents as breaking scroll tracking.

**Decision** *(confirmed with the user)*: treat this as **introducing** virtualisation, and accept it as a structural change rather than a purely visual one — `<Screen scroll={false}>` plus a screen-owned `FlatList numColumns={2}` with `columnWrapperStyle`.

**Consequences that must be tracked as regressions**, not assumed safe:
- `CartSummaryBar.tsx:27` is `absolute left-4 right-4 bottom-4` — it will now float over the list and permanently hide the last row unless bottom `contentContainerStyle` padding is added.
- Empty and skeleton states must move to `ListEmptyComponent` / `ListHeaderComponent`.
- Pull-to-refresh and the existing `load()` path must be re-verified.

**Alternatives rejected**: `flex-wrap` on the existing map (purely visual and zero-risk, but renders every product with no virtualisation — the user chose the rewrite); deferring the grid (loses SC-001, the headline business case).

---

## R13 — Colour reconciliation: all 61 source values accounted for

**Finding**: R4 collapsed 61 measured hex values into a structure but never stated what happened to each. Reconciliation:

- **19 × 3 = 57 occurrences** of `#F97316`, `#FFB020`, `#E4572E` are the tenant **swatch options** in every board's `data-props` block — not palette values. Excluded by rule.
- **~30** map to core tokens or accent-pair members (data-model §2.1, §2.2).
- **~12** are tonal siblings within an existing family — `#E6F3EC` (mint tint), `#FBF1EF`/`#7A1A12` (red tints), `#DCE5F1`/`#BCCBE0`/`#9FB3CF`/`#2E4F7A`/`#23426B` (blue family), `#F4F1EC`/`#E8E3DC`/`#E2DBD1`/`#D9D3CA` (warm neutral ramp). **Rule**: these snap to their family's `soft`/`strong` member unless a screen demonstrably needs the intermediate tone, in which case it is added to that family as a named step — never as a loose hex.
- **`#6EE7B7`** (toast success glyph) was used in a component contract with **no token name** — a value O1 would forbid a developer from writing. **Now named** `accents.mint.glyph`.
- **5** are *old* values appearing only in the "Changed from" column (`#0E9F6E`, `#1F2937`, `#6B7280`, `#E5E7EB`, `#FFF7ED`) — not new tokens.

**Decision**: add the reconciliation rule above to the token contract, and name `#6EE7B7`. An implementer meeting an artboard colour outside the set must add it to the owning family, not inline it.

---

## R14 — Aliased values must be defined once

`#B23C0E` is both `link` and `accents.tangerine.strong`. `#183153` is `primaryVariant`, `accents.blue.strong` and `accents.neutral.strong`. R4's own argument is that defining a value more than once guarantees drift. **Decision**: each distinct value is one constant in `tokens.raw.js`; semantic names reference that constant rather than restating the literal.

---

## Summary of `spec.md` amendments

| # | Requirement | Correction | Status |
|---|---|---|---|
| 1 | FR-003 / FR-003a | Two grounds; seven accent families | ✅ applied |
| 2 | FR-007 / FR-007a | Measured 15-style scale; **no numeric weight anywhere** — extended in rev 3 to class names and header options | ✅ applied |
| 3 | FR-008 | Twelve-step radius scale | ✅ applied |
| 4 | Edge cases | Build-time absence vs runtime resolution failure separated | ✅ applied |
| 5 | FR-010 / SC-008 | Warn-and-fallback, **single fill pairing** (R8) | ⚠️ **rev 2 applied this to FR-010/SC-008 only.** Three contradicting statements survived at `spec.md:37`, `:95`, `:182` and were recorded as applied. **Fixed in rev 3.** |
| 6 | SC-002 | 27 screen files + navigation shell | ✅ applied |
| 7 | SC-004 / FR-002 | Extended to class names that silently stop applying, **and to off-palette class names** | ✅ applied |
| 8 | Assumptions | Register `gender`; no partial rollback; class-name coupling; brand artwork out of scope | ✅ applied |

**Process note**: amendment 5 was marked complete in revision 2 while three statements still said the opposite. The lesson applied in revision 3 — verify an amendment by grepping for the *old* wording, not by confirming the new wording exists.
