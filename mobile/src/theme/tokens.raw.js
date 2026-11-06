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

  // Text and primary action fill.
  espresso: ESPRESSO,
  textPrimary: ESPRESSO,
  textBody: '#4A4756',
  textSecondary: '#5B5866',
  textOnDark: '#D6D4DD',
  link: RUST,

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
  borderSoft: '#EFE3D6',
  borderDashed: '#CFC6BB',
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
  hero: { fontFamily: DISPLAY, fontSize: 36, lineHeight: 40, letterSpacing: -1.2 },
  display: { fontFamily: DISPLAY, fontSize: 34, lineHeight: 38, letterSpacing: -1.2 },
  title: { fontFamily: DISPLAY, fontSize: 28, lineHeight: 32, letterSpacing: -0.8 },
  titleSm: { fontFamily: DISPLAY, fontSize: 24, lineHeight: 28, letterSpacing: -0.5 },
  subtitle: { fontFamily: DISPLAY, fontSize: 20, lineHeight: 24, letterSpacing: -0.3 },
  subtitleSm: { fontFamily: DISPLAY, fontSize: 17, lineHeight: 22, letterSpacing: 0 },

  // Body family — four weights, each its own family.
  price: { fontFamily: BODY_BOLD, fontSize: 16, lineHeight: 22, letterSpacing: 0 },
  bodyLg: { fontFamily: BODY, fontSize: 16, lineHeight: 22, letterSpacing: 0 },
  body: { fontFamily: BODY, fontSize: 15, lineHeight: 21, letterSpacing: 0 },
  bodyBold: { fontFamily: BODY_BOLD, fontSize: 15, lineHeight: 21, letterSpacing: 0 },
  labelLg: { fontFamily: BODY_SEMI, fontSize: 14, lineHeight: 20, letterSpacing: 0 },
  label: { fontFamily: BODY_SEMI, fontSize: 13, lineHeight: 18, letterSpacing: 0 },
  eyebrow: { fontFamily: BODY_BOLD, fontSize: 12, lineHeight: 16, letterSpacing: 1.5 },
  caption: { fontFamily: BODY, fontSize: 12, lineHeight: 16, letterSpacing: 0 },
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
 * Twelve steps (FR-008, research R3). `glyph` (3) is the veg/non-veg dietary
 * mark and is load-bearing — the mark differs in SHAPE as well as colour.
 * `sm` and `lg` keep their names but change value (4->10, 20->14); 33 call
 * sites shift silently, which SC-004 records as intended.
 * @type {Record<string, number>}
 */
const radius = {
  glyph: 3,
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
  radius,
  fontFamilies,
  sanctionedBrandSwatches,
};
