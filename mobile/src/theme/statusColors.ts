// Order-status presentation — specs/017-ui-refresh FR-004 (supersedes
// specs/013-blue-theme-visual-design's flat colour map).
//
// A status is ALWAYS rendered as a labelled badge with a matching dot, never
// colour alone (accessibility: colour is not an accessible distinction on its
// own). Each status maps to one of the shared accent families rather than
// carrying its own hex, so a badge, an icon tile and a product tint of the
// same family cannot drift apart (research R4).
//
// This is the only sanctioned path from a status to a colour — no screen may
// map one itself (contract O3).
//
// The literal union mirrors the order-status values generated from specs/006
// and specs/008's openapi.yaml (src/api/generated/*.d.ts), kept independent
// here because those files export no shared enum. This file does not import
// from src/api/generated — that directory is untouched by this feature.
import { accents, type AccentName, type AccentPair } from './tokens';

export type OrderStatus =
  | 'payment_pending'
  | 'order_placed'
  | 'payment_failed'
  | 'delivered';

export interface StatusColorEntry {
  /** Badge background. */
  soft: string;
  /** Label text. Clears 4.5:1 on `soft`. */
  strong: string;
  /** The 7px leading dot. */
  dot: string;
  label: string;
  /** Retained for callers that still read a single colour; equals `strong`. */
  color: string;
}

const STATUS_ACCENT: Record<OrderStatus, { accent: AccentName; label: string }> = {
  payment_pending: { accent: 'sun', label: 'Payment Pending' },
  order_placed: { accent: 'tangerine', label: 'Order Placed' },
  payment_failed: { accent: 'red', label: 'Payment Failed' },
  delivered: { accent: 'mint', label: 'Delivered' },
};

function entry(pair: AccentPair, label: string): StatusColorEntry {
  return {
    soft: pair.soft,
    strong: pair.strong,
    dot: pair.dot ?? pair.strong,
    label,
    color: pair.strong,
  };
}

export const statusColors: Record<OrderStatus, StatusColorEntry> = {
  payment_pending: entry(accents.sun, STATUS_ACCENT.payment_pending.label),
  order_placed: entry(accents.tangerine, STATUS_ACCENT.order_placed.label),
  payment_failed: entry(accents.red, STATUS_ACCENT.payment_failed.label),
  delivered: entry(accents.mint, STATUS_ACCENT.delivered.label),
};

/**
 * Resolves any status string, including one outside the four designed values
 * (contract G6). An unmapped status renders in the neutral family with its
 * raw value as the label — readable and never blank. The order lifecycle also
 * defines `cancelled`, which no code path currently sets, and a future status
 * must not produce an empty badge.
 */
export function resolveStatus(status: string): StatusColorEntry {
  const known = statusColors[status as OrderStatus];
  if (known) return known;
  return entry(accents.neutral, status);
}

export default statusColors;
