// G5 — tokens.ts and tailwind.config.js must not be able to disagree.
//
// Both derive from tokens.raw.js. tokens.ts reaches it through a cast (the
// .js boundary offers no compile-time guarantee), so this asserts the
// equality at runtime instead — which is exactly what the contract says the
// cast weakens it to.
import rawTokens from '../../src/theme/tokens.raw';
import { colors, accents, typography, spacing, radius, size } from '../../src/theme/tokens';

const tailwindConfig = require('../../tailwind.config.js');

describe('token source of truth', () => {
  it('tokens.ts re-exports tokens.raw.js without altering it', () => {
    expect(colors).toEqual(rawTokens.colors);
    expect(accents).toEqual(rawTokens.accents);
    expect(typography).toEqual(rawTokens.typography);
    expect(spacing).toEqual(rawTokens.spacing);
    expect(radius).toEqual(rawTokens.radius);
    expect(size).toEqual(rawTokens.size);
  });

  it('tailwind.config.js derives every colour from the same source', () => {
    const tw = tailwindConfig.theme.extend.colors;
    // Core palette: camelCase token key -> kebab Tailwind key.
    for (const [key, value] of Object.entries(rawTokens.colors)) {
      const kebab = key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
      expect(tw[kebab]).toBe(value);
    }
    // Accent families flatten to `<family>-<role>`.
    for (const [family, pair] of Object.entries(rawTokens.accents)) {
      for (const [role, value] of Object.entries(pair as Record<string, string>)) {
        expect(tw[`${family}-${role}`]).toBe(value);
      }
    }
  });

  it('keeps the nine colour keys existing importers rely on', () => {
    // Contract §1: `colors` MAY gain keys but MUST NOT lose these.
    for (const key of [
      'primary', 'primaryVariant', 'accent', 'secondary', 'surface',
      'background', 'textPrimary', 'textSecondary', 'border',
    ]) {
      expect(colors).toHaveProperty(key);
      expect(typeof (colors as unknown as Record<string, string>)[key]).toBe("string");
    }
  });

  it('exposes the radius and spacing scales to Tailwind', () => {
    const tw = tailwindConfig.theme.extend;
    for (const [k, v] of Object.entries(rawTokens.radius)) {
      expect(tw.borderRadius[k]).toBe(`${v}px`);
    }
    for (const [k, v] of Object.entries(rawTokens.size)) {
      expect(tw.spacing[k]).toBe(`${v}px`);
    }
  });
});
