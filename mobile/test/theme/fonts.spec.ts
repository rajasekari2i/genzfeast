// G3 / FR-007a — the silent-failure gate.
//
// Android resolves a bundled face by ASSET FILE NAME and collapses any
// numeric weight >= 700 onto a "_bold" filename suffix. So a bundled family
// plus fontWeight 700 looks for "<family>_bold.ttf", does not find it, and
// renders the SYSTEM font — with no exception, no warning, and a green
// typecheck and build. Everything below 700 resolves by accident, so the
// failure looks like "the display font is a bit off" rather than a bug.
//
// This asserts no numeric weight survives ANYWHERE: not in a token, not as a
// `font-bold` class, not in a navigation headerTitleStyle.
import fs from 'fs';
import path from 'path';
import { typography, fontFamilies } from '../../src/theme/tokens';

const SRC = path.join(__dirname, '..', '..', 'src');

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'generated' ? [] : walk(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

const FILES = walk(SRC);

describe('bundled typefaces', () => {
  it('every text style resolves to a bundled face', () => {
    for (const [name, style] of Object.entries(typography)) {
      expect(fontFamilies).toContain(style.fontFamily);
      expect(name && style.fontSize).toBeTruthy();
    }
  });

  it('no text style carries a numeric font weight', () => {
    for (const [name, style] of Object.entries(typography)) {
      expect(Object.keys(style)).not.toContain('fontWeight');
      expect(name).toBeTruthy();
    }
  });

  it('no numeric fontWeight appears as a style property anywhere in src/', () => {
    const offenders = FILES.filter((f) => {
      if (f.includes(`${path.sep}theme${path.sep}`)) return false; // tokens doc comments
      return /fontWeight\s*:/.test(fs.readFileSync(f, 'utf8'));
    });
    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });

  it('no font-weight utility class appears anywhere in src/', () => {
    const WEIGHT_CLASS = /\bfont-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)\b/;
    const offenders = FILES.filter((f) => WEIGHT_CLASS.test(fs.readFileSync(f, 'utf8')));
    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });

  it('declares exactly the five faces the build is expected to bundle', () => {
    expect(fontFamilies.sort()).toEqual(
      [
        'BricolageGrotesque-ExtraBold',
        'Inter-Bold',
        'Inter-ExtraBold',
        'Inter-Medium',
        'Inter-SemiBold',
      ].sort(),
    );
  });
});
