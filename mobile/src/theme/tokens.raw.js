/**
 * GenzFeast raw design tokens — specs/017-ui-refresh (supersedes
 * specs/013-blue-theme-visual-design).
 *
 * THE single source of raw values. Consumed by BOTH:
 *   - src/theme/tokens.ts      (typed re-export; the import surface for app code)
 *   - tailwind.config.js       (require()d; Node/PostCSS cannot load TypeScript)
 *
 * Revision 5 of specs/013 hand-duplicated every value into tailwind.config.js
 * with no check that the two agreed. At this feature's size that would be ~30
 * colours, 7 accent families, 12 radii and 15 text styles maintained twice.
 * This file exists so there is exactly one copy (research R9); the
 * theme/tokens.spec gate asserts the two stay equal.
 *
 * Plain CommonJS with JSDoc annotations — `allowJs` is on, so TypeScript
 * consumes this directly, and the annotations stop string literals widening
 * to `string` where a literal union is required.
 */

// --- Aliased constants (research R14) -------------------------------------
// A value used in more than one semantic role is defined ONCE here and
// referenced by each name. R4's whole argument is that restating a value
// guarantees drift.
const ESPRESSO = '#2B1D16';
const RUST = '#B23C0E'; // link, and tangerine.strong
const NAVY = '#183153'; // primaryVariant, blue.strong, neutral.strong
const TANGERINE = '#FF6B35'; // brand; the ONLY tenant-overridable value (FR-009)

/**
 * Core palette (FR-003, FR-003b).
 * @type {Record<string, string>}
 */
const colors = {
  // Brand — the only per-tenant override (resolveBrandTheme.ts).
  primary: TANGERINE,
  primaryVariant: NAVY,
  // Two tints of the navy chrome, measured off the Company Admin ·
  // Dashboard artboard in docs/ui-screen/GenzFeast-Admin-and-Staff.html:
  // the circular drawer/action buttons sit on navyTint, and the role tag
  // beside the wordmark ('ADMIN'/'STAFF') is navyMuted. Neither is a
  // transparency — both are solid, so they survive over any backdrop.
  navyTint: '#23426B',
  navyMuted: '#BCCBE0',
  // Hairline between the drawer's two nav groups, and the drawer footer
  // line - both measured off the Company Admin - Side menu artboard.
  navyDivider: '#2E4F7A',
  navyFooter: '#9FB3CF',

  // Text and primary action fill.
  espresso: ESPRESSO,
  textPrimary: ESPRESSO,
  textBody: '#4A4756',
  textSecondary: '#5B5866',
  textOnDark: '#D6D4DD',
  // A raised panel ON the espresso ground — the drawer's identity card and
  // the My Orders pickup-code panel both sit on this rather than on a
  // transparency, so the elevation survives on any backdrop.
  espressoRaised: '#3F2C22',
  link: RUST,
  // Destructive outline/label - the red accent family's strong tone,
  // surfaced as a SEMANTIC token so a screen never has to reach into the
  // accents map to express 'this action is destructive' (gate O3).
  danger: '#B42318',

  // Two grounds (research R1): cream for student-facing screens, warm grey
  // for back-of-house. Navy chrome appears only on the latter.
  background: '#FFF8F1',
  backgroundAlt: '#F5F3EF',
  surface: '#FFFFFF',

  // Supporting.
  accent: '#FFC857',
  secondary: '#0B7A55',
  nonVeg: '#9A3412',

  // Borders and disabled. A disabled control differs by BORDER STYLE as well
  // as colour (FR-013) — colour alone is not an accessible distinction.
  border: '#F1E6DA',
  // The 1px hairline on the Dashboard's white quick-link cards.
  borderCard: '#E8E3DC',
  // The unselected filter chip's rule, and the neutral tile behind a
  // row's edit control - both from the Company Admin - Products artboard.
  borderChip: '#DDD6CC',
  tileNeutral: '#F4F1EC',
  borderSoft: '#EFE3D6',
  borderDashed: '#CFC6BB',
  // A warmer dashed rule than `borderDashed`, used for the opt-in CTA at
  // the foot of Contact us rather than for a disabled control.
  borderDashedWarm: '#E1D3C4',
  disabledFill: '#F4EEE7',
  disabledText: '#6E6A78',

  // Overlay and elevation.
  scrim: 'rgba(0, 0, 0, 0.40)',
  shadow: '#000000',
};

/**
 * Soft-accent families (FR-003a, research R4).
 *
 * ONE family set, three consumers: status badges, icon tiles, and the
 * product-image tint rotation. Defining them per consumer is what the
 * research found would drift. Every `strong` on its `soft` clears 4.5:1.
 * @type {Record<string, {soft: string, strong: string, dot?: string, glyph?: string}>}
 */
const accents = {
  tangerine: { soft: '#FFE6DA', strong: RUST, dot: TANGERINE },
  sun: { soft: '#FFF1D6', strong: '#8A5300', dot: '#F59E0B' },
  mint: { soft: '#DDF4EA', strong: '#0B6B4B', dot: '#16A34A', glyph: '#6EE7B7' },
  red: { soft: '#FDE2E1', strong: '#B42318', dot: '#DC2626' },
  violet: { soft: '#EDE7FB', strong: '#4C2E91' },
  blue: { soft: '#E4ECF7', strong: NAVY },
  neutral: { soft: '#ECE8E3', strong: NAVY },
};

const DISPLAY = 'BricolageGrotesque-ExtraBold';
const BODY = 'Inter-Medium';
const BODY_SEMI = 'Inter-SemiBold';
const BODY_BOLD = 'Inter-Bold';
const BODY_XBOLD = 'Inter-ExtraBold';

/**
 * Type scale (FR-007).
 *
 * NOTE THE ABSENCE OF fontWeight — this is load-bearing, not an oversight
 * (FR-007a, research R7). Android resolves a bundled face by asset FILE NAME
 * and collapses any numeric weight >= 700 onto a "_bold" suffix, so
 * { fontFamily: 'Inter-Bold', fontWeight: '700' } looks for
 * "Inter-Bold_bold.ttf", fails to find it, and silently renders the system
 * font. Weight is carried by the family name alone.
 * @type {Record<string, {fontFamily: string, fontSize: number, lineHeight: number, letterSpacing: number}>}
 */
const typography = {
  // Display family — one weight (800), six sizes.
  hero: { fontFamily: DISPLAY, fontSize: 40, lineHeight: 41, letterSpacing: -1.5 },
  display: { fontFamily: DISPLAY, fontSize: 34, lineHeight: 38, letterSpacing: -1 },
  // The admin greeting headline - 32px/34/-1 on the Company Admin -
  // Dashboard artboard, between `display` (34) and `title` (28).
  // The canteen name on Contact us - Bricolage 800 at 30/32/-1.
  displayXs: { fontFamily: DISPLAY, fontSize: 30, lineHeight: 32, letterSpacing: -1 },
  displaySm: { fontFamily: DISPLAY, fontSize: 32, lineHeight: 34, letterSpacing: -1 },
  title: { fontFamily: DISPLAY, fontSize: 28, lineHeight: 30, letterSpacing: -0.8 },
  // The 'GenzFeast' lockup — 26px/-0.8 is the most frequent display size
  // in the redesign canvas (8 uses); it previously had no token and was
  // being approximated by titleSm (24) or title (28).
  wordmark: { fontFamily: DISPLAY, fontSize: 26, lineHeight: 30, letterSpacing: -0.8 },
  // The header lockup is a smaller cut of the wordmark: 20px/-0.5 on the
  // Company Admin - Dashboard artboard, distinct from `subtitle` (20px/0).
  wordmarkSm: { fontFamily: DISPLAY, fontSize: 20, lineHeight: 24, letterSpacing: -0.5 },
  // Hero-row title ('Products') - Bricolage 800 at 22px.
  titleMd: { fontFamily: DISPLAY, fontSize: 22, lineHeight: 26, letterSpacing: -0.5 },
  titleSm: { fontFamily: DISPLAY, fontSize: 24, lineHeight: 28, letterSpacing: -0.5 },
  subtitle: { fontFamily: DISPLAY, fontSize: 20, lineHeight: 24, letterSpacing: 0 },
  subtitleSm: { fontFamily: DISPLAY, fontSize: 18, lineHeight: 22, letterSpacing: 0 },

  // Body family — four weights, each its own family.
  // The floating action label on Company Admin - Products: Inter 800 at
  // 16px. Inter-ExtraBold was bundled but had no token until now.
  action: { fontFamily: BODY_XBOLD, fontSize: 16, lineHeight: 22, letterSpacing: 0 },
  price: { fontFamily: BODY_BOLD, fontSize: 16, lineHeight: 22, letterSpacing: 0 },
  bodyLg: { fontFamily: BODY, fontSize: 16, lineHeight: 22, letterSpacing: 0 },
  body: { fontFamily: BODY, fontSize: 15, lineHeight: 21, letterSpacing: 0 },
  bodyBold: { fontFamily: BODY_BOLD, fontSize: 15, lineHeight: 21, letterSpacing: 0 },
  // Read-only field values on Profile - Inter 600 at 15px, a notch
  // lighter than `bodyBold` (700).
  bodySemi: { fontFamily: BODY_SEMI, fontSize: 15, lineHeight: 21, letterSpacing: 0 },
  // The pill button label on Profile - Inter 700 at 14px.
  labelBold: { fontFamily: BODY_BOLD, fontSize: 14, lineHeight: 20, letterSpacing: 0 },
  labelLg: { fontFamily: BODY_SEMI, fontSize: 14, lineHeight: 20, letterSpacing: 0 },
  label: { fontFamily: BODY_SEMI, fontSize: 13, lineHeight: 18, letterSpacing: 0 },
  // Role tag beside the header wordmark ('ADMIN'/'STAFF') - Inter 600 at
  // 12px with no tracking, unlike `eyebrow` which is bold and tracked.
  tag: { fontFamily: BODY_SEMI, fontSize: 12, lineHeight: 16, letterSpacing: 0 },
  eyebrow: { fontFamily: BODY_BOLD, fontSize: 12, lineHeight: 16, letterSpacing: 1.5 },
  caption: { fontFamily: BODY, fontSize: 12, lineHeight: 16, letterSpacing: 0 },
  // The tiny uppercase switch caption ('SOLD OUT') - 10px/700 at 0.5
  // tracking, smaller and tighter than `captionSm`.
  micro: { fontFamily: BODY_BOLD, fontSize: 10, lineHeight: 13, letterSpacing: 0.5 },
  captionSm: { fontFamily: BODY_SEMI, fontSize: 11, lineHeight: 14, letterSpacing: 0.8 },
};

/**
 * The seven class names screens already use, remapped to the new scale
 * (research R11). Keeping the NAMES stable is what reduces the typography
 * migration from 154 call sites to zero — NativeWind drops an unknown class
 * silently, so deleting a key would unstyle screens with no compile error.
 * @type {Record<string, string>}
 */
const legacyTypographyAliases = {
  h1: 'display',
  h2: 'subtitle',
  body: 'body',
  'body-bold': 'bodyBold',
  price: 'price',
  caption: 'caption',
  button: 'labelLg',
};

/** @type {Record<string, number>} */
const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

/**
 * Control heights (FR-015, FR-016). Named rather than written inline so a
 * component never carries a raw size literal (contract O1), and so the 44
 * minimum is stated once instead of being re-derived per component.
 *
 * `touch` is the accessibility floor — every interactive element meets it,
 * INCLUDING where an artboard draws less (the canvas shows the ADD control
 * at 40 and stepper segments at 34x40; the floor wins).
 * @type {Record<string, number>}
 */
const size = { tile: 40, touch: 44, field: 48, control: 52 };

/**
 * Twelve steps (FR-008, research R3). `glyph` (3) is the veg/non-veg dietary
 * mark and is load-bearing — the mark differs in SHAPE as well as colour.
 * `sm` and `lg` keep their names but change value (4->10, 20->14); 33 call
 * sites shift silently, which SC-004 records as intended.
 * @type {Record<string, number>}
 */
const radius = {
  glyph: 3,
  xxs: 6,
  xs: 8,
  sm: 10,
  md: 12,
  lg: 14,
  xl: 16,
  '2xl': 18,
  '3xl': 20,
  '4xl': 22,
  '5xl': 24,
  '6xl': 28,
  // Semantic, not a scale step: the primary action row on the Company
  // Admin - Dashboard artboard is 26px, which falls between 5xl (24)
  // and 6xl (28). Named by role so the scale stays evenly spaced.
  card: 26,
  '7xl': 32,
  pill: 999,
};

/** Bundled faces. theme/fonts.spec asserts every typography entry resolves to one of these. */
const fontFamilies = [DISPLAY, BODY, BODY_SEMI, BODY_BOLD, 'Inter-ExtraBold'];

/**
 * Tenant brand swatches that pass the espresso-on-brand gate (FR-010).
 * #E4572E is offered by the design canvas but scores 4.42:1 and is NOT here
 * — reported to the designer as a defect in the canvas (research R8).
 * @type {string[]}
 */
const sanctionedBrandSwatches = [TANGERINE, '#F97316', '#FFB020'];

module.exports = {
  colors,
  accents,
  typography,
  legacyTypographyAliases,
  spacing,
  size,
  radius,
  fontFamilies,
  sanctionedBrandSwatches,
};
