/**
 * "Today" / "Yesterday" / "Monday" / "12 Nov 2026" — the section headers on
 * the staff Order History screen.
 *
 * Deliberately compares CALENDAR DAYS, not elapsed hours: an order from
 * 11pm last night is "Yesterday" at 1am, even though it is two hours old,
 * because that is how the person at the counter thinks about it.
 *
 * Weekday names cover the six days before yesterday, so a week never shows
 * two "Monday" sections — day 7 back is already a date.
 */

/** Midnight of the given instant, in the DEVICE's timezone — the counter's own day. */
function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

const MS_PER_DAY = 86_400_000;

/** Whole calendar days between two instants, ignoring clock time. */
export function daysApart(from: Date, to: Date): number {
  return Math.round((startOfLocalDay(to).getTime() - startOfLocalDay(from).getTime()) / MS_PER_DAY);
}

/**
 * The header's name half. `now` is injectable so this is testable and so a
 * long-lived screen can re-label without a clock of its own.
 */
export function dayName(date: Date, now: Date = new Date()): string {
  const delta = daysApart(date, now);
  if (delta <= 0) return 'Today';
  if (delta === 1) return 'Yesterday';
  if (delta < 7) return date.toLocaleDateString(undefined, { weekday: 'long' });
  return formatDayDate(date);
}

/** The date half, e.g. "12 Nov 2026". */
export function formatDayDate(date: Date): string {
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Stable key for grouping — local calendar date, NOT the ISO string, whose
 * UTC date flips at 5:30am IST and would split one canteen day in two.
 */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}
