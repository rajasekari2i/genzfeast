import { Injectable, Logger } from '@nestjs/common';

/**
 * Seam between callers (AuthService, PaymentsService) and whatever actually
 * delivers a push (specs/003-forgot-password-otp-reset tasks.md T004,
 * specs/009-order-fcm-push-notifications research.md §4).
 * `FcmNotificationAdapter` (fcm-notification.adapter.ts) is the real
 * implementation, wired in NotificationsModule via a factory provider that
 * falls back to this file's `LoggingNotificationAdapter` when Firebase isn't
 * configured (003's User Story 3 / SC-006 and 009's Assumptions both commit
 * to best-effort delivery with an always-available in-app fallback, so an
 * unconfigured Firebase is never a hard blocker for either).
 */
export abstract class NotificationPort {
  abstract sendPasswordResetCode(userId: string, code: string): Promise<void>;

  /**
   * specs/009 FR-004/FR-006/FR-010. Returns whether at least one device was
   * sent to successfully, so the caller (PaymentsService's webhook handler)
   * knows which `order_audit_logs` event to write — but never throws, since
   * a delivery failure must never affect the webhook's own success/response
   * (FR-006).
   */
  abstract sendOrderReadyNotification(userId: string, orderId: string, otp: string): Promise<{ sent: boolean }>;
}

/** Fallback used when Firebase isn't configured — see NotificationsModule. */
@Injectable()
export class LoggingNotificationAdapter extends NotificationPort {
  private readonly logger = new Logger(LoggingNotificationAdapter.name);

  async sendPasswordResetCode(userId: string): Promise<void> {
    // Never logs the code itself (spec.md Assumptions: "treated with the
    // same handling care as a password").
    this.logger.log(`Password-reset push suppressed (Firebase not configured) for user ${userId}`);
  }

  async sendOrderReadyNotification(userId: string, orderId: string): Promise<{ sent: boolean }> {
    this.logger.log(`Order-ready push suppressed (Firebase not configured) for user ${userId}, order ${orderId}`);
    return { sent: false };
  }
}
