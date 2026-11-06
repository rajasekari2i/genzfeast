// G7 / SC-004 — the gate for the failure mode nothing else can see.
//
// NativeWind drops an unknown class SILENTLY: no compile error, no build
// error, no runtime warning. So renaming or removing a token key unstyles
// its call sites invisibly, and a class drawn from Tailwind's DEFAULT
// palette (text-red-600) applies a colour the foundations never defined
// while looking perfectly valid.
//
// This is therefore an ALLOW-LIST, not an existence check: a class must
// resolve to a FOUNDATION value, not merely to something Tailwind knows.
import fs from 'fs';
import path from 'path';
import raw from '../../src/theme/tokens.raw';

const SRC = path.join(__dirname, '..', '..', 'src');
const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'generated' ? [] : walk(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

// --- what the foundations actually define -------------------------------
const colourKeys = new Set<string>([
  ...Object.keys(raw.colors).map(kebab),
  ...Object.entries(raw.accents).flatMap(([family, pair]) =>
    Object.keys(pair as Record<string, string>).map((role) => `${family}-${role}`),
  ),
]);
const textStyleKeys = new Set<string>([
  ...Object.keys(raw.typography).map(kebab),
  ...Object.keys(raw.legacyTypographyAliases),
]);
const radiusKeys = new Set(Object.keys(raw.radius));
const fontFamilyKeys = new Set(['display', 'body', 'body-semi', 'body-bold']);

/**
 * Core utilities that carry no theme key and are legitimate. Without this
 * the gate fails on correct code — `text-center` is alignment, not a colour
 * or a size, and bare `border`/`border-t` are widths.
 */
const EXEMPT = new Set([
  'text-center', 'text-left', 'text-right', 'text-justify',
  'border', 'border-t', 'border-b', 'border-l', 'border-r', 'border-x', 'border-y',
  'border-solid', 'border-dashed', 'border-dotted',
]);

const PREFIXES = /\b((?:text|bg|border|rounded|font)-[a-z0-9-]+)\b/g;

function isAllowed(cls: string): boolean {
  if (EXEMPT.has(cls)) return true;
  const [, prefix, rest] = cls.match(/^(text|bg|border|rounded|font)-(.+)$/) ?? [];
  if (!prefix) return false;
  if (prefix === 'rounded') return radiusKeys.has(rest);
  if (prefix === 'font') return fontFamilyKeys.has(rest);
  if (prefix === 'text' && textStyleKeys.has(rest)) return true;
  return colourKeys.has(rest);
}

describe('utility class allow-list', () => {
  const offenders: string[] = [];

  beforeAll(() => {
    for (const file of walk(SRC)) {
      if (file.includes(`${path.sep}theme${path.sep}`)) continue;
      const source = fs.readFileSync(file, 'utf8');
      // Only look inside className values, so prose in comments and
      // unrelated identifiers cannot produce false positives.
      for (const m of source.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\})/g)) {
        const value = m[1] ?? m[2] ?? m[3] ?? '';
        for (const c of value.matchAll(PREFIXES)) {
          const cls = c[1].replace(/\/\d+$/, ''); // strip an opacity modifier
          if (!isAllowed(cls)) offenders.push(`${path.relative(SRC, file)}: ${cls}`);
        }
      }
    }
  });

  it('every text/bg/border/rounded/font class resolves to a foundation value', () => {
    expect(offenders).toEqual([]);
  });

  it('rejects a default-palette class even though Tailwind would resolve it', () => {
    // Guards the allow-list semantics themselves: an existence check against
    // the generated theme would pass these, which is how 46 off-palette
    // usages went unnoticed.
    expect(isAllowed('text-red-600')).toBe(false);
    expect(isAllowed('bg-amber-50')).toBe(false);
    expect(isAllowed('text-slate-500')).toBe(false);
  });

  it('still allows the foundation equivalents and the exempt core utilities', () => {
    expect(isAllowed('text-red-strong')).toBe(true);
    expect(isAllowed('bg-sun-soft')).toBe(true);
    expect(isAllowed('text-body')).toBe(true);
    expect(isAllowed('text-h1')).toBe(true);
    expect(isAllowed('rounded-pill')).toBe(true);
    expect(isAllowed('text-center')).toBe(true);
    expect(isAllowed('border-b')).toBe(true);
  });

  it('rejects a class whose key no longer exists', () => {
    expect(isAllowed('text-h3')).toBe(false);
    expect(isAllowed('rounded-huge')).toBe(false);
  });
});
