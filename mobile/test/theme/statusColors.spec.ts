// G6 / O3 — status presentation.
import fs from 'fs';
import path from 'path';
import { statusColors, resolveStatus, type OrderStatus } from '../../src/theme/statusColors';
import { accents } from '../../src/theme/tokens';

const SRC = path.join(__dirname, '..', '..', 'src');

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'generated' ? [] : walk(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

describe('order status presentation', () => {
  const STATUSES: OrderStatus[] = ['payment_pending', 'order_placed', 'payment_failed', 'delivered'];

  it('maps all four designed statuses to an accent family with a label', () => {
    for (const s of STATUSES) {
      expect(statusColors[s].label.length).toBeGreaterThan(0);
      expect(statusColors[s].soft).toMatch(/^#/);
      expect(statusColors[s].strong).toMatch(/^#/);
      expect(statusColors[s].dot).toMatch(/^#/);
    }
  });

  it('never renders a status by colour alone — every entry carries a label', () => {
    for (const s of STATUSES) expect(statusColors[s].label).not.toBe('');
  });

  it('falls back to neutral with the raw value for an unmapped status', () => {
    // `cancelled` exists in the order lifecycle and in the History filter
    // but no code path sets it; a future status must not render blank.
    const resolved = resolveStatus('cancelled');
    expect(resolved.soft).toBe(accents.neutral.soft);
    expect(resolved.strong).toBe(accents.neutral.strong);
    expect(resolved.label).toBe('cancelled');
  });

  it('never returns an empty label, whatever it is given', () => {
    for (const input of ['', 'wat', 'REFUNDED']) {
      expect(typeof resolveStatus(input).label).toBe('string');
    }
    expect(resolveStatus('wat').label).toBe('wat');
  });

  it('no screen imports the accent families directly (O3)', () => {
    const offenders = walk(path.join(SRC, 'screens')).filter((f) =>
      /from\s+['"].*theme\/accents['"]/.test(fs.readFileSync(f, 'utf8')),
    );
    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });
});
