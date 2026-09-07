// Design Token Set — GenzFeast brand system (orange/campus identity,
// supersedes specs/013-blue-theme-visual-design's original blue palette;
// mechanism and every non-color token below is unchanged).
//
// The single source of truth for every color, typography, spacing, and radius
// value used anywhere in mobile/. No screen or component may hardcode a value
// this file already defines (spec SC-003) — import from here instead.
//
// colors.primary is the ONLY token overridable per tenant, and only via
// resolveBrandTheme.ts at build time (see brand/resolveBrandTheme.ts). Every
// other token is fixed platform-wide.

// Typed as `string`, not narrowed via `as const` — colors.primary is the one
// token a build-time brand override (resolveBrandTheme.ts) may replace with
// an arbitrary tenant-supplied hex value, so its type must accept any hex
// string, not just the literal default.
export interface ColorTokens {
  primary: string;
  /** Navigation/header chrome — "Trust/Navigation" in the brand color system, not a shade of primary. */
  primaryVariant: string;
  accent: string;
  /** Fresh/secondary actions and healthy-food indicators — "Secondary/Fresh" in the brand color system. Not yet consumed by any screen; available for e.g. a future "Fresh" product badge. */
  secondary: string;
  surface: string;
  background: string;
  textPrimary: string;
  textSecondary: string;
  /** Subtle card/chip/divider borders, and disabled-control fills — the one neutral gray in the palette (added during WU2, contracts/design-tokens.md). */
  border: string;
}

export const colors: ColorTokens = {
  primary: '#FF6B35',
  primaryVariant: '#183153',
  accent: '#FFC857',
  secondary: '#0E9F6E',
  surface: '#FFFFFF',
  background: '#FFF7ED',
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
};

export interface TypographyStyle {
  fontSize: number;
  fontWeight: '400' | '600' | '700';
  lineHeight: number;
}

export const typography: Record<
  'h1' | 'h2' | 'body' | 'bodyBold' | 'price' | 'caption' | 'button',
  TypographyStyle
> = {
  h1: { fontSize: 24, fontWeight: '700', lineHeight: 32 },
  h2: { fontSize: 18, fontWeight: '700', lineHeight: 24 },
  body: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
  bodyBold: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  price: { fontSize: 16, fontWeight: '700', lineHeight: 22 },
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
  button: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
};

export const spacing: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', number> = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius: Record<'sm' | 'md' | 'lg' | 'pill', number> = {
  sm: 4,
  md: 12,
  lg: 20,
  pill: 999,
};

export const tokens = { colors, typography, spacing, radius } as const;

export type Tokens = typeof tokens;

export default tokens;
