// G1 / FR-009 — `primary` is the ONLY value a tenant build may override.
import { resolveBrandTheme } from '../../src/theme/brand/resolveBrandTheme';
import defaultTokens, { sanctionedBrandSwatches } from '../../src/theme/tokens';

const COMPANY = '11111111-2222-3333-4444-555555555555';

describe('tenant override surface', () => {
  it('changes primary and nothing else', () => {
    const swatch = sanctionedBrandSwatches.find((s) => s !== defaultTokens.colors.primary)!;
    const { tokens } = resolveBrandTheme(
      { companyId: COMPANY, accentColor: swatch, appDisplayName: 'Block C Canteen' },
      jest.fn(),
    );

    expect(tokens.colors.primary).toBe(swatch);

    const { primary: _a, ...restResolved } = tokens.colors;
    const { primary: _b, ...restDefault } = defaultTokens.colors;
    expect(restResolved).toEqual(restDefault);

    expect(tokens.typography).toEqual(defaultTokens.typography);
    expect(tokens.spacing).toEqual(defaultTokens.spacing);
    expect(tokens.radius).toEqual(defaultTokens.radius);
  });

  it('returns the untouched defaults when no config is supplied', () => {
    expect(resolveBrandTheme(undefined, jest.fn()).tokens).toEqual(defaultTokens);
  });
});
