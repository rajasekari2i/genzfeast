// G2 / G4 / SC-005 / SC-008 — contrast.
//
// Includes the assertion the previous gate design was missing: that a
// PASSING colour is actually accepted. Without it, a gate that rejects
// everything still looks green, which is precisely how the two-leg version
// of this check went unnoticed (research R8).
import { accents, colors, sanctionedBrandSwatches } from '../../src/theme/tokens';
import { contrastRatio, WCAG_AA_MIN_CONTRAST } from '../../src/theme/brand/contrastCheck';
import { resolveBrandTheme } from '../../src/theme/brand/resolveBrandTheme';

const COMPANY = '11111111-2222-3333-4444-555555555555';

describe('accent pairs', () => {
  it('every family\'s strong text clears AA on its own soft background', () => {
    for (const [family, pair] of Object.entries(accents)) {
      const ratio = contrastRatio(pair.strong, pair.soft);
      expect({ family, ratio: Number(ratio.toFixed(2)) }).toEqual({
        family,
        ratio: expect.any(Number),
      });
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_MIN_CONTRAST);
    }
  });
});

describe('core text on both grounds', () => {
  it.each([
    ['textPrimary', 'background'],
    ['textPrimary', 'backgroundAlt'],
    ['textPrimary', 'surface'],
    ['textBody', 'background'],
    ['textSecondary', 'background'],
    ['textSecondary', 'backgroundAlt'],
    ['link', 'background'],
    ['link', 'backgroundAlt'],
  ] as const)('%s on %s clears AA', (fg, bg) => {
    expect(contrastRatio(colors[fg], colors[bg])).toBeGreaterThanOrEqual(WCAG_AA_MIN_CONTRAST);
  });

  it('text on a dark espresso panel clears AA', () => {
    expect(contrastRatio(colors.surface, colors.espresso)).toBeGreaterThanOrEqual(WCAG_AA_MIN_CONTRAST);
    expect(contrastRatio(colors.textOnDark, colors.espresso)).toBeGreaterThanOrEqual(WCAG_AA_MIN_CONTRAST);
  });
});

describe('tenant brand gate (FR-010)', () => {
  const resolve = (accentColor: string) => {
    const warn = jest.fn();
    const result = resolveBrandTheme(
      { companyId: COMPANY, accentColor, appDisplayName: 'Block C Canteen' },
      warn,
    );
    return { result, warn };
  };

  it('accepts every sanctioned swatch — the gate is not rejecting everything', () => {
    for (const swatch of sanctionedBrandSwatches) {
      const { result, warn } = resolve(swatch);
      expect({ swatch, rejected: result.rejectedOverride }).toEqual({ swatch, rejected: false });
      expect(result.tokens.colors.primary).toBe(swatch);
      expect(warn).not.toHaveBeenCalled();
    }
  });

  it('every sanctioned swatch carries espresso text at AA', () => {
    for (const swatch of sanctionedBrandSwatches) {
      expect(contrastRatio(colors.espresso, swatch)).toBeGreaterThanOrEqual(WCAG_AA_MIN_CONTRAST);
    }
  });

  it('rejects #E4572E, which the design canvas offers but which fails at 4.42:1', () => {
    expect(contrastRatio(colors.espresso, '#E4572E')).toBeLessThan(WCAG_AA_MIN_CONTRAST);
    const { result, warn } = resolve('#E4572E');
    expect(result.rejectedOverride).toBe(true);
    expect(result.tokens.colors.primary).toBe(colors.primary);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('warns and falls back rather than throwing — it must not fail the build', () => {
    expect(() => resolve('#000000')).not.toThrow();
    expect(resolve('#000000').result.rejectedOverride).toBe(true);
  });

  it('does not reinstate a brand-as-foreground leg', () => {
    // Requiring BOTH espresso-on-brand and brand-on-cream is unsatisfiable:
    // it needs L(brand) >= 0.2403 and <= 0.1717 at once. If someone re-adds
    // that leg, no swatch can pass and this fails.
    const accepted = sanctionedBrandSwatches.filter((s) => !resolve(s).result.rejectedOverride);
    expect(accepted.length).toBe(sanctionedBrandSwatches.length);
  });
});
