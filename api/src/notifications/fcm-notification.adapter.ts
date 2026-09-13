import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, Message, MulticastMessage } from 'firebase-admin/messaging';
import { NotificationPort } from './notification.port';
import { DevicesService } from '../devices/devices.service';

const FIREBASE_APP_NAME = 'genzfeast-fcm';

/**
 * Real Firebase Cloud Messaging delivery for specs/003-forgot-password-otp-reset's
 * FR-003 — the only NotificationPort call site that exists in this codebase
 * so far. NotificationsModule only provides this adapter when
 * FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY are all present; otherwise it
 * falls back to LoggingNotificationAdapter (see notifications.module.ts).
 */
@Injectable()
export class FcmNotificationAdapter extends NotificationPort {
  private readonly logger = new Logger(FcmNotificationAdapter.name);
  private app: App | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly devicesService: DevicesService,
  ) {
    super();
  }

  private getApp(): App {
    if (this.app) {
      return this.app;
    }
    const existing = getApps().find((a) => a.name === FIREBASE_APP_NAME);
    if (existing) {
      this.app = existing;
      return existing;
    }
    this.app = initializeApp(
      {
        credential: cert({
          projectId: this.configService.getOrThrow<string>('FIREBASE_PROJECT_ID'),
          clientEmail: this.configService.getOrThrow<string>('FIREBASE_CLIENT_EMAIL'),
          // The service-account JSON's private_key contains literal "\n"
          // sequences once it round-trips through an env var — firebase-admin
          // needs real newlines.
          privateKey: this.configService.getOrThrow<string>('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
        }),
      },
      FIREBASE_APP_NAME,
    );
    return this.app;
  }

  async sendPasswordResetCode(userId: string, code: string): Promise<void> {
    const tokens = await this.devicesService.listTokensForUser(userId);
    if (tokens.length === 0) {
      this.logger.warn(`No registered devices for user ${userId} — password-reset push not delivered`);
      return;
    }

    // FR-003 / User Story 3 (spec.md Clarifications 2026-09-06): the code
    // travels ONLY inside the data payload, never a display `notification`
    // field — the mobile app's background handler is what reads it.
    await this.sendMulticast(userId, tokens, {
      tokens,
      data: { type: 'password_reset', code },
      android: { priority: 'high' },
      apns: { headers: { 'apns-priority': '10' }, payload: { aps: { contentAvailable: true } } },
    });
  }

  /**
   * specs/009 FR-004/FR-007. A visible notification (unlike the password-reset
   * data-only message) — this isn't a sensitive one-way secret in the same
   * sense, and FR-004 wants it "announcing" the order. `data.order_id` is
   * what the mobile tap-handler reads to deep-link to that order's detail
   * (research.md §6); the pickup code rides in the visible body text.
   */
  async sendOrderReadyNotification(userId: string, orderId: string, otp: string): Promise<{ sent: boolean }> {
    const tokens = await this.devicesService.listTokensForUser(userId);
    if (tokens.length === 0) {
      this.logger.warn(`No registered devices for user ${userId} — order-ready push not delivered (order ${orderId})`);
      return { sent: false };
    }

    const { successCount } = await this.sendMulticast(userId, tokens, {
      tokens,
      notification: {
        title: 'Order Ready for Pickup!',
        body: `Show this code at the counter: ${otp}`,
      },
      data: { type: 'order_ready', order_id: orderId },
      android: { priority: 'high' },
    });

    return { sent: successCount > 0 };
  }

  /**
   * specs/014-msg91-sms-otp-mobile-verification FR-007. Deliberately a
   * single raw-token `send()`, not `sendMulticast` — this targets exactly
   * the one device the mobile client supplied its own `fcm_token` from,
   * never a `DevicesService` lookup (no `userId` exists yet at this point
   * in registration). Unlike sendPasswordResetCode's data-only shape, this
   * carries a visible `notification` — the student reads the code off the
   * notification and types it in themselves, there's no auto-fill on the
   * client side. `data.code`/`data.mobile_number` still ride along for
   * correlation (see NotificationPort's doc comment), not for delivery.
   */
  async sendMobileVerificationPush(
    fcmToken: string,
    code: string,
    mobileNumber: string,
    ttlMinutes: number,
  ): Promise<{ sent: boolean }> {
    const message: Message = {
      token: fcmToken,
      notification: {
        title: 'GenzFeast Registration OTP',
        body: `DO NOT SHARE: Your Registration OTP is ${code} (Valid for ${ttlMinutes} mins)`,
      },
      data: { type: 'mobile_verification', code, mobile_number: mobileNumber },
      android: { priority: 'high' },
      apns: { headers: { 'apns-priority': '10' } },
    };

    try {
      await getMessaging(this.getApp()).send(message);
      return { sent: true };
    } catch (error) {
      this.logger.warn(`Mobile-verification push failed for a raw token: ${(error as Error).message}`);
      return { sent: false };
    }
  }

  private async sendMulticast(
    userId: string,
    tokens: string[],
    message: MulticastMessage,
  ): Promise<{ successCount: number }> {
    const response = await getMessaging(this.getApp()).sendEachForMulticast(message);
    await Promise.all(
      response.responses.map((result, index) => {
        if (result.success) {
          return undefined;
        }
        this.logger.warn(`FCM send failed for a device of user ${userId}: ${result.error?.message}`);
        // A dead token is permanently unusable — stop sending to it, the
        // same "supersede the stale one" spirit data-model.md's upsert
        // already applies at registration time.
        const deadTokenCodes = ['messaging/invalid-registration-token', 'messaging/registration-token-not-registered'];
        if (result.error && deadTokenCodes.includes(result.error.code)) {
          return this.devicesService.removeToken(tokens[index]);
        }
        return undefined;
      }),
    );
    return { successCount: response.successCount };
  }
}
