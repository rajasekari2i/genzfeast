import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContext, TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { NotificationPort } from '../notifications/notification.port';
import { VerifyOrderCodeDto } from './dto/verify-order-code.dto';
import { PaginatedResult, PaginationQueryDto } from '../common/dto/pagination-query.dto';
import {
  StaffOrderDetailResponse,
  StaffOrderHistoryResponse,
  StaffOrderSummaryResponse,
  toStaffOrderDetailResponse,
  toStaffOrderHistoryResponse,
  toStaffOrderSummaryResponse,
} from './staff-orders.mapper';

export interface VerifySuccessResponse {
  order_id: string;
  status: 'delivered';
  delivered_at: string;
}

export interface MarkReadyResponse {
  order_id: string;
  status: 'order_ready';
}

/**
 * The counter's two-step flow: an order arrives `order_placed` (paid, not
 * cooked), staff mark it `order_ready` when the food is on the counter,
 * and only then can it be handed over against the pickup code.
 *
 * `orders.status` carries no CHECK constraint, so `order_ready` needed no
 * migration — but a handful of places assume the old set, and two of them
 * fail silently rather than loudly if missed:
 *
 *   * student-orders.mapper nulls the pickup code unless the status
 *     matches, which would hide the code at the exact moment the diner is
 *     walking to the counter;
 *   * student-orders.service's `upcoming` bucket, which would drop the
 *     order out of My Orders while it is still very much live.
 *
 * Both are updated alongside this.
 */
const ORDER_PLACED = 'order_placed';
const ORDER_READY = 'order_ready';

/** What the staff queue shows: everything paid for and not yet handed over. */
const INCOMING_STATUSES = [ORDER_PLACED, ORDER_READY];

/**
 * What the History screen shows: orders that have actually been handed
 * over. Deliberately NOT payment_failed or cancelled — those never reached
 * the counter, and mixing them in would make the day's handover count
 * useless at a glance. They remain visible to the diner in My Orders.
 */
const HISTORY_STATUS = 'delivered';

/**
 * specs/005-staff-order-fulfilment-otp. Every method is scoped to
 * `ctx.companyId` (RolesGuard restricts every route here to `staff`, always
 * company-scoped) — no system_admin bypass anywhere in this module, per
 * data-model.md's explicit instruction. Lives in the same `orders` module
 * as StudentOrdersService/PaymentsService — one Order entity, one module,
 * split into per-audience controllers/services rather than per-audience
 * modules.
 */
@Injectable()
export class StaffOrdersService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly notificationPort: NotificationPort,
  ) {}

  /** FR-001/FR-002/FR-010: the live queue (order_placed + order_ready), oldest first — first-in-first-served at the counter. */
  async listIncoming(ctx: TenantContext): Promise<StaffOrderSummaryResponse[]> {
    const orders = await this.tenantPrisma.runInTenantContext(ctx, (tx) =>
      tx.order.findMany({
        where: { companyId: ctx.companyId as string, status: { in: INCOMING_STATUSES } },
        orderBy: { createdAt: 'asc' },
      }),
    );
    return orders.map(toStaffOrderSummaryResponse);
  }

  /**
   * Handed-over orders, newest first, for the staff History screen — the
   * orders that vanish from the queue the moment the pickup code is
   * accepted.
   *
   * Ordered by `delivered_at`, not `created_at`: the screen groups by the
   * day the handover happened, and an order placed late one night and
   * collected the next morning belongs to the morning. Falls back to
   * createdAt in the sort for rows delivered before that column existed.
   *
   * Server-side paginated (10 per page) rather than returning the lot: this
   * list only grows, and a canteen a year in would otherwise ship its
   * entire history to a phone on every screen open.
   *
   * Grouping into Today / Yesterday / weekday sections is left to the
   * client. A day's orders can straddle a page boundary, so the headers
   * have to be derived from the accumulated list anyway — doing it here
   * would mean either page-aware section state or sending the same header
   * twice.
   */
  async listHistory(
    ctx: TenantContext,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<StaffOrderHistoryResponse>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where = { companyId: ctx.companyId as string, status: HISTORY_STATUS };

    const [orders, total] = await this.tenantPrisma.runInTenantContext(ctx, (tx) =>
      Promise.all([
        tx.order.findMany({
          where,
          orderBy: [{ deliveredAt: 'desc' }, { createdAt: 'desc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        tx.order.count({ where }),
      ]),
    );
    return { items: orders.map(toStaffOrderHistoryResponse), page, limit, total };
  }

  /** FR-004/FR-009: full detail, never the code; matches the same NotFound semantics as an already-delivered order (contract's own NotFound description). */
  async getDetail(ctx: TenantContext, orderId: string): Promise<StaffOrderDetailResponse> {
    const order = await this.tenantPrisma.runInTenantContext(ctx, (tx) =>
      tx.order.findFirst({
        where: { id: orderId, companyId: ctx.companyId as string, status: { in: INCOMING_STATUSES } },
      }),
    );
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return toStaffOrderDetailResponse(order);
  }

  /**
   * FR-005..FR-009. A mismatch (including a malformed code — Edge Cases)
   * writes `pickup_verification_failed` and rejects with 422, never
   * touching the order row. A match creates exactly one `deliveries` row
   * (the `UNIQUE(order_id)` constraint is the actual FR-008 backstop against
   * a race between two simultaneous correct submissions — the loser gets
   * the P2002 caught below and a 409, same as an already-delivered order).
   */
  async verify(ctx: TenantContext, orderId: string, dto: VerifyOrderCodeDto): Promise<VerifySuccessResponse> {
    return this.tenantPrisma.runInTenantContext(ctx, async (tx) => {
      const order = await tx.order.findFirst({ where: { id: orderId, companyId: ctx.companyId as string } });
      if (!order) {
        throw new NotFoundException('Order not found');
      }
      if (order.status === 'delivered') {
        throw new ConflictException('Order has already been delivered');
      }
      if (order.status === ORDER_PLACED) {
        // Readiness is a MANDATORY step, so this is a real state, not a
        // missing order — saying "not found" about an order the staff
        // member is looking at would be actively misleading. 422 with the
        // actual reason instead.
        throw new UnprocessableEntityException('Mark the order ready before handing it over');
      }
      if (order.status !== ORDER_READY) {
        // e.g. payment_pending/cancelled — not actionable here (Assumptions).
        throw new NotFoundException('Order not found');
      }

      if (order.otp !== dto.code) {
        await tx.orderAuditLog.create({
          data: {
            orderId: order.id,
            companyId: order.companyId,
            eventType: 'pickup_verification_failed',
            performedBy: ctx.userId,
          },
        });
        throw new UnprocessableEntityException('Pickup code does not match');
      }

      try {
        await tx.delivery.create({
          data: { orderId: order.id, companyId: order.companyId, deliveredBy: ctx.userId as string },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException('Order has already been delivered');
        }
        throw error;
      }

      const updated = await tx.order.update({
        where: { id: order.id },
        data: { status: 'delivered', deliveredAt: new Date() },
      });

      await tx.orderAuditLog.createMany({
        data: [
          {
            orderId: order.id,
            companyId: order.companyId,
            eventType: 'pickup_verification_succeeded',
            performedBy: ctx.userId,
          },
          { orderId: order.id, companyId: order.companyId, eventType: 'order_delivered', performedBy: ctx.userId },
        ],
      });

      return {
        order_id: updated.id,
        status: 'delivered' as const,
        // Set immediately above, in the same update call.
        delivered_at: updated.deliveredAt!.toISOString(),
      };
    });
  }

  /**
   * order_placed -> order_ready: the food is on the counter. Pushes "Order
   * Ready for Pickup!" to the diner who placed it.
   *
   * The push is sent AFTER the transaction commits, deliberately. Holding a
   * DB transaction open across a network call to Firebase would pin a
   * connection for the length of someone else's outage, and the status
   * change is the thing that must not be lost — a push that fails is
   * recoverable (the diner still sees the status in My Orders), a status
   * that rolled back because FCM was slow is not. Same reasoning, and the
   * same `sent ? ... : ...` audit pair, as PaymentsService's own dispatch.
   */
  async markReady(ctx: TenantContext, orderId: string): Promise<MarkReadyResponse> {
    const transition = await this.tenantPrisma.runInTenantContext(ctx, async (tx) => {
      const order = await tx.order.findFirst({ where: { id: orderId, companyId: ctx.companyId as string } });
      if (!order) {
        throw new NotFoundException('Order not found');
      }
      if (order.status === ORDER_READY) {
        // Idempotent in spirit but reported honestly: two staff tapping the
        // same card should not fire two pushes at the diner.
        throw new ConflictException('Order is already marked ready');
      }
      if (order.status === 'delivered') {
        throw new ConflictException('Order has already been delivered');
      }
      if (order.status !== ORDER_PLACED) {
        // payment_pending/payment_failed — nothing to make ready yet.
        throw new NotFoundException('Order not found');
      }

      const updated = await tx.order.update({
        where: { id: order.id },
        data: { status: ORDER_READY, updatedBy: ctx.userId },
      });
      await tx.orderAuditLog.create({
        data: {
          orderId: order.id,
          companyId: order.companyId,
          eventType: 'order_marked_ready',
          performedBy: ctx.userId,
        },
      });
      return { userId: updated.userId, companyId: updated.companyId, otp: updated.otp ?? '' };
    });

    const { sent } = await this.notificationPort
      .sendOrderReadyNotification(transition.userId, orderId, transition.otp)
      .catch(() => ({ sent: false }));

    await this.tenantPrisma.runInTenantContext(ctx, (tx) =>
      tx.orderAuditLog.create({
        data: {
          orderId,
          companyId: transition.companyId,
          eventType: sent ? 'order_ready_notification_sent' : 'order_ready_notification_failed',
          performedBy: ctx.userId,
        },
      }),
    );

    return { order_id: orderId, status: 'order_ready' };
  }
}
