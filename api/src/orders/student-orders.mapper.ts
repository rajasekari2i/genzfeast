import type { Order } from '@prisma/client';

/** The frozen shape stored in `orders.items` (data-model.md §1) — set once, at placement, never re-derived. */
export interface OrderItemSnapshot {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  line_total: number;
}

/** Wire shape of contracts/openapi.yaml's ProductForBrowsing schema. */
export interface ProductForBrowsingResponse {
  id: string;
  name: string;
  description: string;
  image_url: string | null;
  price: number;
  is_veg: boolean;
  is_soldout: boolean;
}

/** Wire shape of contracts/openapi.yaml's Order schema (list view). */
export interface OrderResponse {
  id: string;
  status: string;
  total_amount: number;
  placed_at: string;
}

/** Wire shape of contracts/openapi.yaml's OrderDetail schema (specs/006, extended by specs/008 research.md §3). */
export interface OrderDetailResponse extends OrderResponse {
  items: OrderItemSnapshot[];
  /**
   * The flat handling charge actually applied to THIS order, in paise —
   * read from the stored column, never re-derived from current config,
   * which may have changed since the order was placed.
   *
   * `total_amount` = sum of the items' line_total + this. Sent even when
   * zero, so the client can render the breakdown without guessing whether
   * a missing field means "no fee" or "old API".
   */
  processing_fee: number;
  /** Sum of the items' line_total, i.e. total_amount minus processing_fee. Convenience for the receipt. */
  items_total: number;
  fulfilment_type: string;
  /**
   * Present while the order is live and uncollected — order_placed OR
   * order_ready (FR-013 in specs/006); null once delivered.
   *
   * order_ready is load-bearing here: the diner reads this code at the
   * counter, and that happens precisely AFTER staff mark the order ready.
   * Checking for order_placed alone would blank the code at the exact
   * moment it is needed.
   */
  otp: string | null;
  /** specs/008 FR-008 — present only once status = delivered (written by specs/005's fulfilment flow); null otherwise. */
  delivered_at: string | null;
}

/** Wire shape of contracts/openapi.yaml's OrderWithPaymentSession schema. */
export interface OrderWithPaymentSessionResponse extends OrderResponse {
  payment_session: {
    gateway_ref: string | null;
  };
}

function toOrderItems(items: unknown): OrderItemSnapshot[] {
  if (!Array.isArray(items)) {
    return [];
  }
  return items.filter(
    (item): item is OrderItemSnapshot =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as OrderItemSnapshot).product_id === 'string' &&
      typeof (item as OrderItemSnapshot).name === 'string' &&
      typeof (item as OrderItemSnapshot).price === 'number' &&
      typeof (item as OrderItemSnapshot).quantity === 'number' &&
      typeof (item as OrderItemSnapshot).line_total === 'number',
  );
}

export function toOrderResponse(order: Order): OrderResponse {
  return {
    id: order.id,
    status: order.status,
    total_amount: order.totalAmount,
    placed_at: order.createdAt.toISOString(),
  };
}

export function toOrderDetailResponse(order: Order): OrderDetailResponse {
  return {
    ...toOrderResponse(order),
    items: toOrderItems(order.items),
    processing_fee: order.processingFee,
    items_total: order.totalAmount - order.processingFee,
    fulfilment_type: order.fulfilmentType,
    otp: order.status === 'order_placed' || order.status === 'order_ready' ? order.otp : null,
    delivered_at: order.status === 'delivered' ? (order.deliveredAt?.toISOString() ?? null) : null,
  };
}

export function toOrderWithPaymentSessionResponse(order: Order): OrderWithPaymentSessionResponse {
  return {
    ...toOrderResponse(order),
    payment_session: { gateway_ref: order.paymentGatewayRef },
  };
}
