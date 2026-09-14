import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const MSG91_FLOW_URL = 'https://control.msg91.com/api/v5/flow/';

/**
 * Real MSG91 SMS delivery. Originally built for
 * specs/014-msg91-sms-otp-mobile-verification only; now also used by
 * specs/003-forgot-password-otp-reset's forgot-password flow when the
 * requesting user's own Company has `is_sms=true` (AuthService.requestPasswordReset
 * decides which method to call — order-pickup OTP stays on FCM regardless of
 * this setting). Deliberately a separate, narrower service, not a
 * NotificationPort implementation, since NotificationPort's other two
 * methods (order-ready, and password-reset's own FCM branch) never need SMS.
 *
 * Uses MSG91's Flow API (template-based, DLT-compliant) purely as a send
 * mechanism — NOT MSG91's own OTP-generate/verify API — so verification
 * stays DB-driven via this codebase's existing OtpService hash/verify/TTL
 * pattern (otp.service.ts), consistent with how both OTP flows already work.
 *
 * Each distinct message gets its own DLT-approved template id
 * (MSG91_TEMPLATE_ID_MOBILE_VERIFICATION / MSG91_TEMPLATE_ID_PASSWORD_RESET)
 * — India's DLT regulation requires the exact registered SMS text per
 * distinct message, so one template can never be reused for the other's
 * wording.
 *
 * MSG91's exact Flow API field names were not verified against live docs in
 * this session — the payload shape below is a best-effort draft. The HTTP
 * call is isolated in one shared private method specifically so this is a
 * one-place fix if MSG91's actual contract differs. Unlike a
 * NotificationPort adapter, this has no LoggingNotificationAdapter-style
 * silent fallback — an unconfigured MSG91 throws; callers decide what to do
 * with that (AuthService.sendMobileVerification surfaces it directly per
 * that method's own contract, while AuthService.requestPasswordReset falls
 * back to FCM push on failure, matching sendMobileVerification's own
 * SMS-failure-falls-back-to-push behavior).
 */
@Injectable()
export class Msg91SmsAdapter {
  private readonly logger = new Logger(Msg91SmsAdapter.name);

  constructor(private readonly configService: ConfigService) {}

  async sendVerificationCode(mobileNumber: string, code: string): Promise<void> {
    await this.send('MSG91_TEMPLATE_ID_MOBILE_VERIFICATION', mobileNumber, code);
  }

  /** specs/003-forgot-password-otp-reset (revised) — SMS branch of the per-Company `is_sms` routing. */
  async sendPasswordResetCode(mobileNumber: string, code: string): Promise<void> {
    await this.send('MSG91_TEMPLATE_ID_PASSWORD_RESET', mobileNumber, code);
  }

  private async send(templateIdEnvKey: string, mobileNumber: string, code: string): Promise<void> {
    const authKey = this.configService.get<string>('MSG91_AUTH_KEY');
    const senderId = this.configService.get<string>('MSG91_SENDER_ID');
    const templateId = this.configService.get<string>(templateIdEnvKey);
    if (!authKey || !senderId || !templateId) {
      throw new Error(`MSG91 is not configured (MSG91_AUTH_KEY/MSG91_SENDER_ID/${templateIdEnvKey})`);
    }

    let response: Response;
    try {
      response = await fetch(MSG91_FLOW_URL, {
        method: 'POST',
        headers: { authkey: authKey, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          template_id: templateId,
          sender: senderId,
          short_url: '0',
          recipients: [{ mobiles: `91${mobileNumber}`, OTP: code }],
        }),
      });
    } catch (error) {
      this.logger.warn(`MSG91 send threw for ${mobileNumber}: ${(error as Error).message}`);
      throw error;
    }

    if (!response.ok) {
      throw new Error(`MSG91 send failed for ${mobileNumber}: HTTP ${response.status}`);
    }
    const body = (await response.json()) as { type?: string };
    if (body.type !== 'success') {
      throw new Error(`MSG91 did not confirm delivery of the SMS to ${mobileNumber}`);
    }
  }
}
