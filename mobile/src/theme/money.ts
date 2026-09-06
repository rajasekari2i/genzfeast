// Shared money-formatting helper — CLAUDE.md "Data Conventions": money is
// always stored as an integer (paise), never a float. Single source of truth
// so ProductCard and CartSummaryBar can't silently drift from each other.
export function formatRupees(priceInPaise: number): string {
  return `₹${(priceInPaise / 100).toFixed(2)}`;
}
