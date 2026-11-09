// Design Token Set — GenzFeast brand system (specs/017-ui-refresh,
// superseding specs/013-blue-theme-visual-design).
//
// This file is now a TYPED RE-EXPORT of tokens.raw.js, which is the single
// source of raw values shared with tailwind.config.js (research R9). Its
// public shape is deliberately unchanged: `colors`, `typography`, `spacing`,
// `radius` and `tokens` all still export, and `ColorTokens.primary` is still
// typed `string` so a tenant override remains assignable.
//
// colors.primary is the ONLY token a tenant build may override, and only via
// brand/resolveBrandTheme.ts at build time. Every other value is fixed
// platform-wide (FR-009).
//
// No screen or component may hardcode a value defined here (FR-002) — that
// now covers styling CLASS NAMES too, not just literals, because the app
// styles through utility classes and NativeWind drops an unknown class
// silently (research R11).
import raw from './tokens.raw';

/**
 * Typed as `string`, not a literal union — `primary` is the one token a
 * build-time brand override may replace with an arbitrary tenant hex.
 */
export interface ColorTokens {
  /** Brand. The only tenant-overridable token. */
  primary: string;
  /** Navigation/header chrome on back-of-house surfaces. */
  primaryVariant: string;
  /** Circular controls inside the navy header (AdminHeader). */
  navyTint: string;
  /** The role tag beside the header wordmark. */
  navyMuted: string;
  /** Divider between the drawer's nav groups. */
  navyDivider: string;
  /** The drawer's footer line. */
  navyFooter: string;
  /** Primary text AND primary action fill. */
  espresso: string;
  /** Alias of `espresso`; retained so existing importers keep compiling. */
  textPrimary: string;
  textBody: string;
  textSecondary: string;
  /** Text on an espresso ground. */
  textOnDark: string;
  /** A raised panel on the espresso ground. */
  espressoRaised: string;
  /** Links and brand-coloured text. The brand itself never clears 4.5:1 as a foreground. */
  link: string;
  /** Destructive action outline/label. */
  danger: string;
  /** Student-facing ground. */
  background: string;
  /** Back-of-house ground (research R1 — the app has two grounds, not one). */
  backgroundAlt: string;
  surface: string;
  accent: string;
  /** Veg mark. */
  secondary: string;
  nonVeg: string;
  border: string;
  /** Hairline on the Dashboard quick-link cards. */
  borderCard: string;
  borderSoft: string;
  /** Disabled/read-only outline — a dashed border, so the state differs in SHAPE not just colour. */
  borderDashed: string;
  disabledFill: string;
  disabledText: string;
  /** Modal overlay. */
  scrim: string;
  /** Elevation shadow colour. */
  shadow: string;
}

/**
 * A soft-accent family (FR-003a). One set, three consumers: status badges,
 * icon tiles, and the product-image tint rotation.
 */
export interface AccentPair {
  soft: string;
  strong: string;
  dot?: string;
  glyph?: string;
}

export type AccentName =
  | 'tangerine'
  | 'sun'
  | 'mint'
  | 'red'
  | 'violet'
  | 'blue'
  | 'neutral';

/**
 * A text style. NOTE: there is deliberately NO `fontWeight` (FR-007a).
 * Android resolves a bundled face by asset FILE NAME and collapses any
 * numeric weight >= 700 onto a "_bold" suffix, so a bundled family plus a
 * weight silently renders the system font. Weight is carried by the family.
 */
export interface TypographyStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
}

export type TypographyName =
  | 'hero' | 'display' | 'displaySm' | 'wordmark' | 'wordmarkSm'
  | 'title' | 'titleSm'
  | 'titleMd' | 'subtitle' | 'subtitleSm'
  | 'price' | 'bodyLg' | 'body' | 'bodyBold'
  | 'bodySemi' | 'labelBold' | 'labelLg' | 'label' | 'tag'
  | 'eyebrow' | 'caption' | 'captionSm';

export type SpacingName = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/** Control heights. `touch` (44) is the accessibility floor — FR-015. */
export type SizeName = 'touch' | 'field' | 'control';

export type RadiusName =
  | 'glyph' | 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'card' | 'pill';

// tokens.raw.js is annotated with broad JSDoc types (Record<string, string>
// etc.) so that tailwind.config.js can consume it without TypeScript. These
// casts narrow it to the interfaces above. The cast is why G5
// (theme/tokens.spec) asserts the two agree at RUNTIME — a compile-time
// guarantee is not available across the .js boundary.
export const colors = raw.colors as unknown as ColorTokens;
export const accents = raw.accents as unknown as Record<AccentName, AccentPair>;
export const typography = raw.typography as unknown as Record<TypographyName, TypographyStyle>;
export const spacing = raw.spacing as unknown as Record<SpacingName, number>;
export const size = raw.size as unknown as Record<SizeName, number>;
export const radius = raw.radius as unknown as Record<RadiusName, number>;

/** The five bundled faces. theme/fonts.spec asserts every style resolves to one. */
export const fontFamilies = raw.fontFamilies as string[];

/**
 * Tenant brand swatches that pass the espresso-on-brand gate. `#E4572E` is
 * offered by the design canvas but scores 4.42:1 and is excluded — a defect
 * in the canvas, reported to the designer (research R8).
 */
export const sanctionedBrandSwatches = raw.sanctionedBrandSwatches as string[];

export const tokens = { colors, typography, spacing, radius } as const;

export type Tokens = typeof tokens;

export default tokens;
