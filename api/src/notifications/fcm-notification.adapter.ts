import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';
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
