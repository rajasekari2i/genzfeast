import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContext, TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { VerifyOrderCodeDto } from './dto/verify-order-code.dto';
import {
  StaffOrderDetailResponse,
  StaffOrderSummaryResponse,
  toStaffOrderDetailResponse,
  toStaffOrderSummaryResponse,
} from './staff-orders.mapper';

export interface VerifySuccessResponse {
  order_id: string;
  status: 'delivered';
  delivered_at: string;
}

const INCOMING_STATUS = 'order_placed';

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
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  /** FR-001/FR-002/FR-010: only order_placed orders, oldest first (first-in-first-served at the counter). */
  async listIncoming(ctx: TenantContext): Promise<StaffOrderSummaryResponse[]> {
    const orders = await this.tenantPrisma.runInTenantContext(ctx, (tx) =>
      tx.order.findMany({
        where: { companyId: ctx.companyId as string, status: INCOMING_STATUS },
        orderBy: { createdAt: 'asc' },
      }),
    );
    return orders.map(toStaffOrderSummaryResponse);
  }

  /** FR-004/FR-009: full detail, never the code; matches the same NotFound semantics as an already-delivered order (contract's own NotFound description). */
  async getDetail(ctx: TenantContext, orderId: string): Promise<StaffOrderDetailResponse> {
    const order = await this.tenantPrisma.runInTenantContext(ctx, (tx) =>
      tx.order.findFirst({ where: { id: orderId, companyId: ctx.companyId as string, status: INCOMING_STATUS } }),
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
      if (order.status !== INCOMING_STATUS) {
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
}
