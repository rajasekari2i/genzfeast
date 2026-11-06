// O2 / FR-003 — the app has TWO grounds, and a screen DECLARES which.
//
// Student-facing screens sit on cream; Company Admin and Staff screens sit
// on warm grey with navy chrome. Before this feature Screen.tsx hardcoded a
// single ground, so the split could not be expressed at all.
import fs from 'fs';
import path from 'path';

const SCREENS = path.join(__dirname, '..', '..', 'src', 'screens');

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : /\.tsx$/.test(e.name) ? [p] : [];
  });
}

const BACK_OF_HOUSE = path.join(SCREENS, 'tenant-admin-staff');

/**
 * Decorative fills that are a surface WITHIN a screen, not its ground:
 * a product-image placeholder and two thumbnail boxes.
 */
const GROUND_EXEMPT = new Set([
  'components/ProductCard.tsx',
]);

describe('screen grounds', () => {
  it('every back-of-house screen declares the admin ground', () => {
    const missing = walk(BACK_OF_HOUSE).filter(
      (f) => !/surface=["{]?["']?admin/.test(fs.readFileSync(f, 'utf8')),
    );
    expect(missing.map((f) => path.relative(SCREENS, f))).toEqual([]);
  });

  it('no screen hardcodes a ground colour class', () => {
    const offenders: string[] = [];
    for (const f of walk(SCREENS)) {
      const rel = path.relative(SCREENS, f);
      if (GROUND_EXEMPT.has(rel)) continue;
      const src = fs.readFileSync(f, 'utf8');
      // A ground belongs to Screen via `surface`; a screen setting it
      // directly re-introduces the hardcoding this prop exists to remove.
      for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
        const v = m[1] ?? m[2] ?? '';
        if (/\bbg-background(-alt)?\b/.test(v) && !/flex-1/.test(v)) {
          offenders.push(`${rel}: ${v.trim().slice(0, 50)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('covers all 27 screen files', () => {
    expect(walk(SCREENS).length).toBe(27);
  });
});
