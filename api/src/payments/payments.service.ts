import { randomInt } from 'crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { TenantContext, TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { RazorpayService } from './razorpay.service';
import { NotificationPort } from '../notifications/notification.port';

/**
 * The payment webhook has no user session at all — it's a server-to-server
 * call from Razorpay, authenticated by signature, not a JWT
 * (specs/006-student-browse-cart-checkout research.md §4). Runs under its
 * own narrowly-scoped system-actor identity, the same pattern already
 * established for `auth_service` (specs/002/003/009) — matched by the
 * `payment_service_orders` RLS policy (migration 20260906190000).
 */
export const PAYMENT_SERVICE_ACTOR = 'payment_service';
const PAYMENT_SERVICE_CONTEXT: TenantContext = { role: 'system_actor', systemActor: PAYMENT_SERVICE_ACTOR };

/**
 * Razorpay's real webhook envelope (not the OpenAPI contract's illustrative
 * `{gateway_ref, event}` simplification — see this module's own README note
 * / the #22 issue). Only the fields this handler actually reads.
 */
export interface RazorpayWebhookEnvelope {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        order_id?: string;
      };
    };
  };
}

function interpretRazorpayEvent(envelope: RazorpayWebhookEnvelope): { gatewayRef: string; success: boolean } | null {
  const orderId = envelope.payload?.payment?.entity?.order_id;
  if (!orderId) {
    return null;
  }
  if (envelope.event === 'payment.captured') {
    return { gatewayRef: orderId, success: true };
  }
  if (envelope.event === 'payment.failed') {
    return { gatewayRef: orderId, success: false };
  }
  // Any other Razorpay event (e.g. order.paid, refund.*) — not this
  // handler's concern; acknowledged as a no-op by the caller.
  return null;
}

function generateNumericOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

interface SuccessTransition {
  success: true;
  userId: string;
  orderId: string;
  companyId: string;
  otp: string;
}
interface FailureTransition {
  success: false;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly razorpayService: RazorpayService,
    private readonly notificationPort: NotificationPort,
  ) {}

  /**
   * FR-011/FR-012/FR-014, research.md §5. Rejects with 400 before touching
   * the DB at all if the signature doesn't check out. specs/010 rewrites the
   * lookup key and the idempotency/finalization rule: the webhook now keys
   * off `payment_attempts.gateway_ref` (never `orders.payment_gateway_ref`,
   * which "Resume Payment" now overwrites on every retry), and applies the
   * *asymmetric* reconciliation rule from data-model.md's Reconciliation
   * Logic Summary — a **success** is honored whenever the order is still
   * `payment_pending`, regardless of whether this attempt is the current
   * one (the money has already moved; a superseded attempt succeeding late
   * must not be silently dropped). A **failure** only finalizes the order
   * when the attempt is both current AND the order is still pending — a
   * late failure for an attempt the student has since superseded (via
   * retry) must never overturn an order they may have already paid for.
   * Every non-transitioning case (redelivered event, already-finalized
   * order, superseded failure) still gets its own `payment_attempt_no_op`
   * audit row — this is payment money; silence is not an acceptable outcome
   * for any branch. specs/009 FR-004/research.md §4: a successful
   * transition additionally sends the order-ready push — as a separate call
   * after the state-changing transaction commits (an external network call
   * has no business holding a Postgres transaction open, same reasoning as
   * StudentOrdersService.placeOrder's Razorpay-order-creation call), with
   * its own outcome logged as a further, independent audit write (FR-010).
   */
  async handleWebhook(rawBody: Buffer, signatureHeader: string | undefined, payload: unknown): Promise<void> {
    if (!this.razorpayService.verifyWebhookSignature(rawBody, signatureHeader)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const outcome = interpretRazorpayEvent((payload ?? {}) as RazorpayWebhookEnvelope);
    if (!outcome) {
      return;
    }

    const transition = await this.tenantPrisma.runInTenantContext(
      PAYMENT_SERVICE_CONTEXT,
      async (tx): Promise<SuccessTransition | FailureTransition | null> => {
        const attempt = await tx.paymentAttempt.findUnique({
          where: { gatewayRef: outcome.gatewayRef },
          include: { order: true },
        });
        if (!attempt) {
          this.logger.warn(`Webhook for unrecognized gateway_ref ${outcome.gatewayRef} — acknowledged, no-op`);
          return null;
        }
        if (attempt.outcome !== null) {
          // Idempotency guard — this exact attempt was already resolved
          // (redelivered webhook event); never reprocess it.
          return null;
        }
        const order = attempt.order;

        if (outcome.success) {
          if (order.status !== 'payment_pending') {
            // Order already finalized by a different attempt (or this one,
            // concurrently). Money moved on THIS attempt but the order's
            // fate was already decided — record it, don't touch the order.
            await tx.paymentAttempt.update({
              where: { id: attempt.id },
              data: { outcome: 'success', resolvedAt: new Date() },
            });
            await tx.orderAuditLog.create({
              data: {
                orderId: order.id,
                companyId: order.companyId,
                eventType: 'payment_attempt_no_op',
                performedBy: null,
              },
            });
            return null;
          }

          const otp = generateNumericOtp();
          await tx.paymentAttempt.update({
            where: { id: attempt.id },
            data: { outcome: 'success', resolvedAt: new Date() },
          });
          const updated = await tx.order.update({
            where: { id: order.id },
            data: { status: 'order_placed', paymentStatus: 'success', otp },
          });
          await tx.orderAuditLog.create({
            data: { orderId: order.id, companyId: order.companyId, eventType: 'payment_succeeded', performedBy: null },
          });
          return { success: true, userId: updated.userId, orderId: updated.id, companyId: updated.companyId, otp };
        }

        const shouldFinalizeFailure = attempt.isCurrent && order.status === 'payment_pending';
        await tx.paymentAttempt.update({
          where: { id: attempt.id },
          data: { outcome: 'failed', resolvedAt: new Date() },
        });
        if (!shouldFinalizeFailure) {
          // Either superseded (student already retried) or the order was
          // already finalized some other way — must never overturn it.
          await tx.orderAuditLog.create({
            data: {
              orderId: order.id,
              companyId: order.companyId,
              eventType: 'payment_attempt_no_op',
              performedBy: null,
            },
          });
          return null;
        }

        await tx.order.update({
          where: { id: order.id },
          data: { status: 'payment_failed', paymentStatus: 'failed' },
        });
        await tx.orderAuditLog.create({
          data: { orderId: order.id, companyId: order.companyId, eventType: 'payment_failed', performedBy: null },
        });
        return { success: false };
      },
    );

    if (!transition?.success) {
      return;
    }

    // specs/009 FR-006: a delivery failure/timeout must never surface as a
    // webhook error — the code is already persisted regardless of outcome.
    const { sent } = await this.notificationPort
      .sendOrderReadyNotification(transition.userId, transition.orderId, transition.otp)
      .catch(() => ({ sent: false }));

    await this.tenantPrisma.runInTenantContext(PAYMENT_SERVICE_CONTEXT, (tx) =>
      tx.orderAuditLog.create({
        data: {
          orderId: transition.orderId,
          companyId: transition.companyId,
          eventType: sent ? 'order_ready_notification_sent' : 'order_ready_notification_failed',
          performedBy: null,
        },
      }),
    );
  }
}
