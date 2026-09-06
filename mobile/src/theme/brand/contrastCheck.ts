// WCAG 2.1 contrast-ratio utility — specs/013-blue-theme-visual-design
// research.md §2. Hand-rolled rather than a dependency: the formula is a
// small, stable W3C spec used in exactly one place (resolveBrandTheme.ts)
// plus its own unit tests.
//
// Reference: https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio

const HEX_PATTERN = /^#([0-9A-Fa-f]{6})$/;

export function isValidHexColor(hex: string): boolean {
  return HEX_PATTERN.test(hex);
}

function hexToRgb(hex: string): [number, number, number] {
  const match = HEX_PATTERN.exec(hex);
  if (!match) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  const int = parseInt(match[1], 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function channelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(channelToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colors, in the range [1, 21]. */
export function contrastRatio(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexA);
  const lumB = relativeLuminance(hexB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG 2.1 AA minimum contrast ratio for normal-size text (spec FR-012). */
export const WCAG_AA_MIN_CONTRAST = 4.5;

/**
 * True if `foreground` meets WCAG 2.1 AA contrast (4.5:1) against every
 * color in `backgrounds`. Used to gate a tenant's brand accentColor before
 * it is allowed to replace colors.primary in a build.
 */
export function meetsAAContrast(foreground: string, backgrounds: string[]): boolean {
  if (!isValidHexColor(foreground)) {
    return false;
  }
  return backgrounds.every(
    (bg) => isValidHexColor(bg) && contrastRatio(foreground, bg) >= WCAG_AA_MIN_CONTRAST,
  );
}
