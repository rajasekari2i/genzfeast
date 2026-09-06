import { formatRupees } from '../../src/theme/money';

describe('formatRupees', () => {
  it('formats whole-rupee and sub-rupee integer paise amounts correctly', () => {
    expect(formatRupees(0)).toBe('₹0.00');
    expect(formatRupees(1)).toBe('₹0.01');
    expect(formatRupees(50)).toBe('₹0.50');
    expect(formatRupees(999)).toBe('₹9.99');
  });

  it('formats large integer paise amounts without float rounding artifacts', () => {
    expect(formatRupees(100000)).toBe('₹1000.00');
    expect(formatRupees(123456789)).toBe('₹1234567.89');
    // 10005 / 100 = 100.05 exactly in decimal, but is a classic float-rounding
    // trap in binary floating point — confirms toFixed(2) masks it correctly.
    expect(formatRupees(10005)).toBe('₹100.05');
  });
});
