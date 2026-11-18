import type { Order } from '@prisma/client';

export interface StaffOrderItem {
  name: string;
  quantity: number;
  price: number;
}

/** Wire shape of specs/005 contracts/openapi.yaml's OrderSummary schema — never includes the pickup code (FR-009). */
export interface StaffOrderSummaryResponse {
  id: string;
  reference: string;
  item_count: number;
  total_amount: number;
  placed_at: string;
  /** order_placed (needs marking ready) or order_ready (handover allowed). */
  status: string;
}

/** Wire shape of specs/005 contracts/openapi.yaml's OrderDetail schema — never includes the pickup code (FR-009). */
export interface StaffOrderDetailResponse {
  id: string;
  reference: string;
  items: StaffOrderItem[];
  total_amount: number;
  placed_at: string;
  /** order_placed (needs marking ready) or order_ready (handover allowed). */
  status: string;
}

/**
 * Wire shape of a handed-over order on the staff History screen. Carries
 * `delivered_at` — the queue's own rows never need it, since nothing in
 * the queue has been delivered yet — and it is what the screen groups by.
 */
export interface StaffOrderHistoryResponse {
  id: string;
  reference: string;
  item_count: number;
  total_amount: number;
  placed_at: string;
  delivered_at: string | null;
}

/**
 * data-model.md's own note: `reference` is derived from `id` at read time
 * (a short uppercased prefix), not a stored column — the owning Checkout &
 * Payment feature (specs/006) is free to add a real order-number column
 * later without this feature needing a contract change.
 */
function toReference(orderId: string): string {
  return orderId.slice(0, 8).toUpperCase();
}

function toStaffOrderItems(items: unknown): StaffOrderItem[] {
  if (!Array.isArray(items)) {
    return [];
  }
  return items.filter(
    (item): item is StaffOrderItem =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as StaffOrderItem).name === 'string' &&
      typeof (item as StaffOrderItem).quantity === 'number' &&
      typeof (item as StaffOrderItem).price === 'number',
  );
}

export function toStaffOrderSummaryResponse(order: Order): StaffOrderSummaryResponse {
  return {
    id: order.id,
    reference: toReference(order.id),
    item_count: toStaffOrderItems(order.items).reduce((sum, item) => sum + item.quantity, 0),
    total_amount: order.totalAmount,
    placed_at: order.createdAt.toISOString(),
    status: order.status,
  };
}

export function toStaffOrderDetailResponse(order: Order): StaffOrderDetailResponse {
  return {
    id: order.id,
    reference: toReference(order.id),
    items: toStaffOrderItems(order.items),
    total_amount: order.totalAmount,
    placed_at: order.createdAt.toISOString(),
    status: order.status,
  };
}

export function toStaffOrderHistoryResponse(order: Order): StaffOrderHistoryResponse {
  return {
    id: order.id,
    reference: toReference(order.id),
    item_count: toStaffOrderItems(order.items).reduce((sum, item) => sum + item.quantity, 0),
    total_amount: order.totalAmount,
    placed_at: order.createdAt.toISOString(),
    // Nullable in the schema, so not assumed: an order delivered before
    // this column existed would have none, and the screen falls back to
    // placed_at for grouping rather than dropping the row.
    delivered_at: order.deliveredAt?.toISOString() ?? null,
  };
}
