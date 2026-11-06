// Build-time tenant brand resolution — specs/013-blue-theme-visual-design
// data-model.md §2, research.md §3.
//
// Per-tenant branding is a BUILD-TIME concern only (one CI build per tenant
// flavor, per docs/architecture/04-Architecture.md's "Mobile builds" note) —
// this runs once during the build/bundling step, never at runtime. It merges
// an optional TenantBrandConfig on top of the Design Token Set defaults,
// gating the overridden accent color behind a WCAG AA contrast check
// (FR-012). statusColors, typography, spacing, and radius are never touched
// by this flow (FR-011).
import { colors as defaultColors, tokens as defaultTokens, Tokens } from '../tokens';
import { isValidHexColor, meetsAAContrast } from './contrastCheck';

/** Shape validated against contracts/tenant-brand-config.schema.json. */
export interface TenantBrandConfig {
  companyId: string;
  accentColor: string;
  logoAssetPath?: string;
  appDisplayName: string;
}

export interface ResolvedBrandTheme {
  tokens: Tokens;
  logoAssetPath?: string;
  appDisplayName?: string;
  /** True when a supplied accentColor was rejected and the default was used instead. */
  rejectedOverride: boolean;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidTenantBrandConfig(config: unknown): config is TenantBrandConfig {
  if (typeof config !== 'object' || config === null) return false;
  const c = config as Record<string, unknown>;
  return (
    typeof c.companyId === 'string' &&
    UUID_PATTERN.test(c.companyId) &&
    typeof c.accentColor === 'string' &&
    isValidHexColor(c.accentColor) &&
    typeof c.appDisplayName === 'string' &&
    c.appDisplayName.length > 0 &&
    c.appDisplayName.length <= 30 &&
    (c.logoAssetPath === undefined ||
      (typeof c.logoAssetPath === 'string' && c.logoAssetPath.length > 0))
  );
}

/**
 * Resolves the theme for one build: the platform defaults, optionally
 * overridden by a validated, contrast-passing TenantBrandConfig.
 *
 * `onWarn` (defaults to console.warn) is called with a human-readable
 * message whenever a supplied accentColor is rejected, so a CI build log
 * always shows why a branded build fell back to the default blue.
 */
export function resolveBrandTheme(
  config?: unknown,
  onWarn: (message: string) => void = console.warn,
): ResolvedBrandTheme {
  if (config === undefined) {
    return { tokens: defaultTokens, rejectedOverride: false };
  }

  if (!isValidTenantBrandConfig(config)) {
    onWarn(
      'resolveBrandTheme: supplied tenant brand config does not match tenant-brand-config.schema.json — using platform default theme.',
    );
    return { tokens: defaultTokens, rejectedOverride: false };
  }

  // FR-010 / research R8: the gate checks EXACTLY ONE pairing — espresso
  // text on the brand fill.
  //
  // The previous revision also required the brand to be legible AS a
  // foreground on the ground/surface. Those two constraints are
  // mathematically incompatible: carrying espresso text needs
  // L(brand) >= 0.2403, reading on cream needs L(brand) <= 0.1717, so the
  // feasible set is EMPTY — no colour in sRGB would pass, and every tenant
  // override would silently fall back to the default while the gate's own
  // test still passed.
  //
  // Dropping the foreground leg is safe because the redesign never uses the
  // brand colour as text: links use colors.link (#B23C0E, 5.63:1 on cream)
  // and controls use espresso. The brand appears only as a FILL.
  const accentPasses = meetsAAContrast(defaultColors.espresso, [config.accentColor]);

  if (!accentPasses) {
    onWarn(
      `resolveBrandTheme: accentColor "${config.accentColor}" for company ${config.companyId} fails WCAG 2.1 AA contrast — falling back to the default brand colour (${defaultColors.primary}). Logo/app name overrides still applied.`,
    );
    return {
      tokens: defaultTokens,
      logoAssetPath: config.logoAssetPath,
      appDisplayName: config.appDisplayName,
      rejectedOverride: true,
    };
  }

  const resolvedTokens: Tokens = {
    ...defaultTokens,
    colors: { ...defaultColors, primary: config.accentColor },
  };

  return {
    tokens: resolvedTokens,
    logoAssetPath: config.logoAssetPath,
    appDisplayName: config.appDisplayName,
    rejectedOverride: false,
  };
}

export default resolveBrandTheme;
