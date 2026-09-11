import { randomUUID } from 'crypto';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContext, TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { RazorpayService } from '../payments/razorpay.service';
import { PlaceOrderRequestDto } from './dto/place-order.dto';
import {
  OrderDetailResponse,
  OrderItemSnapshot,
  OrderResponse,
  OrderWithPaymentSessionResponse,
  ProductForBrowsingResponse,
  toOrderDetailResponse,
  toOrderResponse,
  toOrderWithPaymentSessionResponse,
} from './student-orders.mapper';

const UNRESOLVED_STATUSES = ['payment_pending', 'payment_failed'];

/** specs/008-my-orders-history-upcoming research.md §1/§4 — a query-param filter, not separate endpoints. */
export type OrdersView = 'upcoming' | 'history';
const VIEW_STATUS_FILTERS: Record<OrdersView, string[]> = {
  upcoming: ['payment_pending', 'order_placed'],
  // 'cancelled' included for schema completeness — no flow in this
  // platform ever produces it in V1 (research.md §4), so it never actually
  // matches a row; kept so a future cancellation feature needs no edit here.
  history: ['delivered', 'payment_failed', 'cancelled'],
};

/** Shape matches contracts/openapi.yaml's UnavailableItemsError — HttpExceptionFilter preserves extra fields on a non-string exception response. */
export class UnavailableItemsException extends ConflictException {
  constructor(unavailableProductIds: string[]) {
    super({
      message: 'One or more items in your cart are no longer available',
      unavailable_product_ids: unavailableProductIds,
    });
  }
}

/**
 * specs/006-student-browse-cart-checkout. Every method is scoped to
 * `ctx.companyId`/`ctx.userId` — RolesGuard restricts every route here to
 * `student`, and `ctx` (from the verified JWT via TenantContextInterceptor)
 * already carries that student's own real identity, so it's passed directly
 * to `runInTenantContext` throughout (no system-actor bypass anywhere in
 * this module — that only exists in PaymentsService, for the webhook).
 */
@Injectable()
export class StudentOrdersService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly razorpayService: RazorpayService,
  ) {}

  /** FR-001/FR-002: every non-removed product, sold-out ones included and clearly flagged. */
  async listProducts(ctx: TenantContext): Promise<ProductForBrowsingResponse[]> {
    const products = await this.tenantPrisma.runInTenantContext(ctx, (tx) =>
      tx.product.findMany({
        where: { companyId: ctx.companyId as string, isDeleted: false },
        orderBy: { name: 'asc' },
      }),
    );
    return products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      image_url: p.imageUrl,
      price: p.price,
      is_veg: p.isVeg,
      is_soldout: p.isSoldout,
    }));
  }

  /** `view` omitted preserves specs/006's original unfiltered behavior (research.md §1). */
  async listOrders(ctx: TenantContext, view?: OrdersView): Promise<OrderResponse[]> {
    const orders = await this.tenantPrisma.runInTenantContext(ctx, (tx) =>
      tx.order.findMany({
        where: {
          userId: ctx.userId as string,
          companyId: ctx.companyId as string,
          ...(view && { status: { in: VIEW_STATUS_FILTERS[view] } }),
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
    return orders.map(toOrderResponse);
  }

  /** 404 (never 403) for a foreign/nonexistent order, so cross-student access reveals nothing (FR-013/FR-017). */
  async getOrder(ctx: TenantContext, orderId: string): Promise<OrderDetailResponse> {
    const order = await this.tenantPrisma.runInTenantContext(ctx, (tx) =>
      tx.order.findFirst({ where: { id: orderId, userId: ctx.userId as string, companyId: ctx.companyId as string } }),
    );
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return toOrderDetailResponse(order);
  }

  /**
   * FR-008/FR-009/FR-016/FR-020, research.md §2/§3. Returns the existing
   * unresolved order (200-equivalent, controller sets status) instead of
   * inserting a second one; otherwise re-validates every item server-side
   * and builds the immutable snapshot from that data alone — the request's
   * own price/name (there is none — see PlaceOrderRequestDto) never factors
   * in. The Razorpay call happens OUTSIDE any DB transaction (a network
   * round-trip has no business holding a Postgres transaction open); the
   * order row is inserted once, already carrying its gateway ref, rather
   * than insert-then-update.
   */
  async placeOrder(
    ctx: TenantContext,
    dto: PlaceOrderRequestDto,
  ): Promise<{ order: OrderWithPaymentSessionResponse; created: boolean }> {
    const existing = await this.tenantPrisma.runInTenantContext(ctx, (tx) =>
      tx.order.findFirst({
        where: { userId: ctx.userId as string, companyId: ctx.companyId as string, status: { in: UNRESOLVED_STATUSES } },
      }),
    );
    if (existing) {
      return { order: toOrderWithPaymentSessionResponse(existing), created: false };
    }

    const productIds = dto.items.map((item) => item.product_id);
    const products = await this.tenantPrisma.runInTenantContext(ctx, (tx) =>
      tx.product.findMany({ where: { id: { in: productIds }, companyId: ctx.companyId as string } }),
    );
    const productsById = new Map(products.map((p) => [p.id, p]));

    const unavailableProductIds = dto.items
      .filter((item) => {
        const product = productsById.get(item.product_id);
        return !product || product.isDeleted || product.isSoldout;
      })
      .map((item) => item.product_id);
    if (unavailableProductIds.length > 0) {
      throw new UnavailableItemsException(unavailableProductIds);
    }

    const items: OrderItemSnapshot[] = dto.items.map((item) => {
      // Guaranteed present — checked above.
      const product = productsById.get(item.product_id)!;
      return {
        product_id: product.id,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        line_total: product.price * item.quantity,
      };
    });
    const totalAmount = items.reduce((sum, item) => sum + item.line_total, 0);

    const orderId = randomUUID();
    const gatewayOrder = await this.razorpayService.createOrder(totalAmount, orderId);

    const created = await this.tenantPrisma.runInTenantContext(ctx, async (tx) => {
      const order = await tx.order.create({
        data: {
          id: orderId,
          companyId: ctx.companyId as string,
          userId: ctx.userId as string,
          items: items as unknown as Prisma.InputJsonValue,
          totalAmount,
          paymentGatewayRef: gatewayOrder.gatewayRef,
          createdBy: ctx.userId,
        },
      });
      await tx.paymentAttempt.create({
        data: { orderId: order.id, gatewayRef: gatewayOrder.gatewayRef },
      });
      await tx.orderAuditLog.create({
        data: { orderId: order.id, companyId: order.companyId, eventType: 'order_created', performedBy: ctx.userId },
      });
      return order;
    });

    return { order: toOrderWithPaymentSessionResponse(created), created: true };
  }

  /**
   * specs/010-resume-pending-order-payment. Reuses the same order row — no
   * new order is ever inserted — and now also works from `payment_pending`
   * (a stuck/abandoned checkout, not just an outright `payment_failed`),
   * since "Resume Payment" and "Pay Again" are the same underlying action
   * (spec's own Assumption). The prior current `payment_attempts` row is
   * superseded (`is_current = false`) rather than reused: a late webhook for
   * THAT gateway ref must still be able to find its row and, per the
   * asymmetric reconciliation rule, a success on it is honored (money moved)
   * while a failure on it is a no-op (superseded, order may since be paid).
   */
  async retryPayment(ctx: TenantContext, orderId: string): Promise<OrderWithPaymentSessionResponse> {
    const order = await this.tenantPrisma.runInTenantContext(ctx, (tx) =>
      tx.order.findFirst({ where: { id: orderId, userId: ctx.userId as string, companyId: ctx.companyId as string } }),
    );
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.status !== 'payment_failed' && order.status !== 'payment_pending') {
      throw new ConflictException('Order is not in a resumable payment state');
    }

    const gatewayOrder = await this.razorpayService.createOrder(order.totalAmount, order.id);

    const updated = await this.tenantPrisma.runInTenantContext(ctx, async (tx) => {
      await tx.paymentAttempt.updateMany({
        where: { orderId: order.id, isCurrent: true },
        data: { isCurrent: false },
      });
      await tx.paymentAttempt.create({
        data: { orderId: order.id, gatewayRef: gatewayOrder.gatewayRef },
      });
      // Re-checked atomically here (not just the read at the top of this
      // method) — a concurrent webhook can move the order past
      // payment_failed/payment_pending between that initial read and this
      // update. Without this guard, Prisma finds zero matching rows and
      // throws an unhandled P2025 instead of a proper 409.
      let row;
      try {
        row = await tx.order.update({
          where: { id: order.id, status: { in: ['payment_failed', 'payment_pending'] } },
          data: {
            status: 'payment_pending',
            paymentStatus: 'pending',
            paymentGatewayRef: gatewayOrder.gatewayRef,
            updatedBy: ctx.userId,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          throw new ConflictException('Order is not in a resumable payment state');
        }
        throw error;
      }
      await tx.orderAuditLog.create({
        data: {
          orderId: row.id,
          companyId: row.companyId,
          eventType: 'payment_retry_initiated',
          performedBy: ctx.userId,
        },
      });
      return row;
    });

    return toOrderWithPaymentSessionResponse(updated);
  }
}
