import {
  contrastRatio,
  isValidHexColor,
  meetsAAContrast,
  WCAG_AA_MIN_CONTRAST,
} from '../../src/theme/brand/contrastCheck';
import { colors } from '../../src/theme/tokens';

describe('isValidHexColor', () => {
  it('accepts a well-formed 6-digit hex color', () => {
    expect(isValidHexColor('#1565C0')).toBe(true);
    expect(isValidHexColor('#abcdef')).toBe(true);
  });

  it('rejects malformed input', () => {
    expect(isValidHexColor('1565C0')).toBe(false); // missing #
    expect(isValidHexColor('#FFF')).toBe(false); // 3-digit shorthand not supported
    expect(isValidHexColor('#GGGGGG')).toBe(false); // invalid hex digits
    expect(isValidHexColor('blue')).toBe(false);
  });
});

describe('contrastRatio', () => {
  it('returns the maximum ratio (21:1) for pure black on pure white', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
  });

  it('returns 1:1 for identical colors', () => {
    expect(contrastRatio('#1565C0', '#1565C0')).toBeCloseTo(1, 5);
  });

  it('is symmetric regardless of argument order', () => {
    const ab = contrastRatio('#1565C0', '#FFFFFF');
    const ba = contrastRatio('#FFFFFF', '#1565C0');
    expect(ab).toBeCloseTo(ba, 10);
  });
});

describe('meetsAAContrast', () => {
  it('passes for a dark accent color rendered on the platform light backgrounds', () => {
    // textPrimary is itself a text/foreground color, not a background layer,
    // so it is deliberately excluded here — only background/surface are
    // things a foreground color is actually rendered on top of.
    expect(meetsAAContrast('#004D40', [colors.background, colors.surface])).toBe(true);
  });

  it('fails for a pale, low-contrast accent color', () => {
    expect(meetsAAContrast('#FFF9C4', [colors.background, colors.surface])).toBe(false);
  });

  it('fails fast for an invalid hex color without throwing', () => {
    expect(meetsAAContrast('not-a-color', [colors.background])).toBe(false);
  });

  it('requires the ratio to meet the documented AA minimum', () => {
    // Sanity-check the exported constant matches the WCAG 2.1 AA threshold used by FR-012.
    expect(WCAG_AA_MIN_CONTRAST).toBe(4.5);
  });

  it('supports checking a white button label against a color used as the button fill', () => {
    // resolveBrandTheme's second gate: white (#FFFFFF) as the foreground, the
    // candidate accent color as the background it is used with.
    expect(meetsAAContrast('#FFFFFF', ['#004D40'])).toBe(true); // dark teal fill — legible white label
    expect(meetsAAContrast('#FFFFFF', ['#FFF9C4'])).toBe(false); // pale yellow fill — illegible white label
  });
});
