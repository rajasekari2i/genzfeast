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

  /**
   * specs/014-msg91-sms-otp-mobile-verification FR-007 — the one exception
   * in this codebase to every other NotificationPort call being keyed by an
   * existing `users` row: no account exists yet at this point in
   * registration, so this sends directly to a raw token supplied by the
   * mobile client rather than looking anything up via DevicesService.
   * Best-effort (never throws) — AuthService.sendMobileVerification decides
   * what to do when this comes back `{ sent: false }`. `mobileNumber` rides
   * along in the push payload (not used for delivery, only correlation) —
   * kept even though the code is now shown in a visible notification body
   * rather than auto-filled, since it's still a harmless, useful
   * correlation key for any future tap-handling. A visible `notification`
   * (title/body), unlike every other NotificationPort push: the student
   * reads and types the code themselves rather than the app auto-filling
   * it, so it must actually show up in the system tray. `ttlMinutes` is
   * interpolated into that body text ("Valid for N mins") from the same
   * config value the OTP itself expires by, so the message can never claim
   * a validity window that doesn't match reality.
   */
  abstract sendMobileVerificationPush(
    fcmToken: string,
    code: string,
    mobileNumber: string,
    ttlMinutes: number,
  ): Promise<{ sent: boolean }>;
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

  async sendMobileVerificationPush(): Promise<{ sent: boolean }> {
    this.logger.log('Mobile-verification push fallback suppressed (Firebase not configured)');
    return { sent: false };
  }
}
