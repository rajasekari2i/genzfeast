// Order-status → {color, label} map — specs/013-blue-theme-visual-design
// contracts/design-tokens.md "Status Colors".
//
// Consumed by StatusBadge wherever an order status is shown (Student My
// Orders/Order Detail, Staff Incoming Orders, any admin order view — FR-002).
// Every status MUST be paired with its text label, never color alone (FR-003).
//
// order_placed intentionally reuses colors.primary directly rather than a
// tenant-overridden brand color, so a branded build never changes what a
// status color means (see resolveBrandTheme.ts and data-model.md §1).
//
// This mirrors the literal order-status union already generated from
// specs/006 and specs/008's openapi.yaml (see src/api/generated/*.d.ts) —
// kept as an independent literal type here since the generated files don't
// export a single shared enum.
import { colors } from './tokens';

export type OrderStatus =
  | 'payment_pending'
  | 'order_placed'
  | 'payment_failed'
  | 'delivered';

export interface StatusColorEntry {
  color: string;
  label: string;
}

export const statusColors: Record<OrderStatus, StatusColorEntry> = {
  payment_pending: { color: '#F9A825', label: 'Payment Pending' },
  order_placed: { color: colors.primary, label: 'Order Placed' },
  payment_failed: { color: '#D32F2F', label: 'Payment Failed' },
  delivered: { color: '#2E7D32', label: 'Delivered' },
};

export default statusColors;
