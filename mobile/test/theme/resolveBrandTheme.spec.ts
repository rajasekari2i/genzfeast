import { resolveBrandTheme } from '../../src/theme/brand/resolveBrandTheme';
import { tokens as defaultTokens, colors as defaultColors } from '../../src/theme/tokens';

const VALID_COMPANY_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

describe('resolveBrandTheme', () => {
  it('returns the platform defaults unchanged when no config is supplied', () => {
    const result = resolveBrandTheme(undefined);
    expect(result.tokens).toEqual(defaultTokens);
    expect(result.rejectedOverride).toBe(false);
    expect(result.appDisplayName).toBeUndefined();
  });

  it('applies a passing accentColor override, leaving every other token untouched', () => {
    const onWarn = jest.fn();
    const result = resolveBrandTheme(
      {
        companyId: VALID_COMPANY_ID,
        accentColor: '#004D40', // dark teal — passes AA against the light defaults
        appDisplayName: 'Campus Bites',
        logoAssetPath: 'brands/campus-bites/icon.png',
      },
      onWarn,
    );

    expect(result.tokens.colors.primary).toBe('#004D40');
    expect(result.tokens.colors).toMatchObject({
      ...defaultColors,
      primary: '#004D40',
    });
    expect(result.tokens.typography).toEqual(defaultTokens.typography);
    expect(result.tokens.spacing).toEqual(defaultTokens.spacing);
    expect(result.tokens.radius).toEqual(defaultTokens.radius);
    expect(result.appDisplayName).toBe('Campus Bites');
    expect(result.logoAssetPath).toBe('brands/campus-bites/icon.png');
    expect(result.rejectedOverride).toBe(false);
    expect(onWarn).not.toHaveBeenCalled();
  });

  it('falls back to the default primary color when accentColor fails the AA contrast check, but still applies logo/app name', () => {
    const onWarn = jest.fn();
    const result = resolveBrandTheme(
      {
        companyId: VALID_COMPANY_ID,
        accentColor: '#FFF9C4', // pale yellow — fails AA
        appDisplayName: 'Campus Bites',
        logoAssetPath: 'brands/campus-bites/icon.png',
      },
      onWarn,
    );

    expect(result.tokens.colors.primary).toBe(defaultColors.primary);
    expect(result.appDisplayName).toBe('Campus Bites');
    expect(result.logoAssetPath).toBe('brands/campus-bites/icon.png');
    expect(result.rejectedOverride).toBe(true);
    expect(onWarn).toHaveBeenCalledTimes(1);
    expect(onWarn.mock.calls[0][0]).toMatch(/fails WCAG 2.1 AA contrast/);
  });

  it('rejects a malformed config (schema mismatch) and falls back to full defaults', () => {
    const onWarn = jest.fn();
    const result = resolveBrandTheme(
      { companyId: 'not-a-uuid', accentColor: '#004D40', appDisplayName: 'X' },
      onWarn,
    );

    expect(result.tokens).toEqual(defaultTokens);
    expect(result.rejectedOverride).toBe(false); // rejected at the schema stage, not the contrast stage
    expect(onWarn).toHaveBeenCalledTimes(1);
    expect(onWarn.mock.calls[0][0]).toMatch(/does not match tenant-brand-config/);
  });

  it('rejects a malformed (non-hex) accentColor at the schema stage, not the contrast stage', () => {
    const onWarn = jest.fn();
    const result = resolveBrandTheme(
      { companyId: VALID_COMPANY_ID, accentColor: 'notahexcolor', appDisplayName: 'Campus Bites' },
      onWarn,
    );

    expect(result.tokens).toEqual(defaultTokens);
    expect(result.rejectedOverride).toBe(false); // schema-stage rejection, distinct from a contrast-stage rejection
    expect(onWarn).toHaveBeenCalledTimes(1);
    expect(onWarn.mock.calls[0][0]).toMatch(/does not match tenant-brand-config/);
    expect(onWarn.mock.calls[0][0]).not.toMatch(/WCAG/); // must not be misreported as a contrast failure
  });

  it('rejects a config missing the required appDisplayName field', () => {
    const onWarn = jest.fn();
    const result = resolveBrandTheme(
      { companyId: VALID_COMPANY_ID, accentColor: '#004D40' },
      onWarn,
    );

    expect(result.tokens).toEqual(defaultTokens);
    expect(onWarn).toHaveBeenCalledTimes(1);
  });
});
