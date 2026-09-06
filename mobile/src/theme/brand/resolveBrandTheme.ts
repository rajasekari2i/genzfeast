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

  // colors.primary is used two ways (contracts/design-tokens.md): as a
  // foreground (links, active nav/tab, directly on the screen's light
  // background/surface), and as a button fill with a white label on top
  // (PrimaryButton). Both usages must independently clear WCAG AA.
  const legibleAsForeground = meetsAAContrast(config.accentColor, [
    defaultColors.background,
    defaultColors.surface,
  ]);
  const legibleAsButtonFill = meetsAAContrast('#FFFFFF', [config.accentColor]);
  const accentPasses = legibleAsForeground && legibleAsButtonFill;

  if (!accentPasses) {
    onWarn(
      `resolveBrandTheme: accentColor "${config.accentColor}" for company ${config.companyId} fails WCAG 2.1 AA contrast — falling back to the default primary color (${defaultColors.primary}). Logo/app name overrides still applied.`,
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
