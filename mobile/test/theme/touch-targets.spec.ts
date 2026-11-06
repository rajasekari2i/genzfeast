// O4 / FR-015 / SC-006 — the 44-unit minimum.
//
// Asserts over CODE, not over a table in a markdown file. The artboards draw
// the ADD control at 40 and stepper segments at 34x40; the accessibility
// floor wins over the design, so those were raised rather than reproduced.
import fs from 'fs';
import path from 'path';
import { size } from '../../src/theme/tokens';

const SRC = path.join(__dirname, '..', '..', 'src');

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'generated' ? [] : walk(p);
    return /\.tsx$/.test(e.name) ? [p] : [];
  });
}

describe('touch targets', () => {
  it('declares 44 as the floor', () => {
    expect(size.touch).toBe(44);
    expect(size.field).toBeGreaterThanOrEqual(size.touch);
    expect(size.control).toBeGreaterThanOrEqual(size.touch);
  });

  it('no INTERACTIVE element sets an explicit height below the floor', () => {
    // Scoped to pressables on purpose: a loading placeholder or a divider
    // may legitimately be 16px tall. Only something you can tap carries the
    // 44 floor.
    const INTERACTIVE = /<(?:Pressable|TouchableOpacity|TouchableHighlight|TouchableWithoutFeedback|Button)\b[^>]*/g;
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const src = fs.readFileSync(file, 'utf8');
      for (const tag of src.match(INTERACTIVE) ?? []) {
        for (const h of tag.matchAll(/\bmin-h-(\d+)|\bh-(\d+)\b/g)) {
          const px = Number(h[1] ?? h[2]) * 4; // Tailwind's numeric scale is 4px units
          if (px < size.touch) {
            offenders.push(`${path.relative(SRC, file)}: ${h[0]} (${px}px)`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('uses the named height tokens rather than raw values on controls', () => {
    const named = walk(SRC)
      .map((f) => fs.readFileSync(f, 'utf8'))
      .join('\n')
      .match(/\b(?:min-)?h-(touch|field|control)\b/g);
    // The components rebuilt in this feature should actually be using them.
    expect((named ?? []).length).toBeGreaterThan(5);
  });
});
