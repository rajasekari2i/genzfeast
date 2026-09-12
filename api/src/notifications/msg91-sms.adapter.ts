import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const MSG91_FLOW_URL = 'https://control.msg91.com/api/v5/flow/';

/**
 * Real MSG91 SMS delivery for specs/014-msg91-sms-otp-mobile-verification —
 * used ONLY by registration-time mobile-number verification. Every other
 * OTP flow in this codebase (password-reset, order-pickup) stays on FCM
 * (NotificationPort/FcmNotificationAdapter) — this is deliberately a
 * separate, narrower service, not a NotificationPort implementation, since
 * only this one flow ever needs SMS.
 *
 * Uses MSG91's Flow API (template-based, DLT-compliant) purely as a send
 * mechanism — NOT MSG91's own OTP-generate/verify API — so verification
 * stays DB-driven via this codebase's existing OtpService hash/verify/TTL
 * pattern (otp.service.ts), consistent with how the other two OTP flows
 * already work.
 *
 * MSG91's exact Flow API field names were not verified against live docs in
 * this session — the payload shape below is a best-effort draft. The HTTP
 * call is isolated in one method specifically so this is a one-place fix if
 * MSG91's actual contract differs. Unlike a NotificationPort adapter, this
 * has no LoggingNotificationAdapter-style silent fallback — an unconfigured
 * MSG91 throws, since AuthService.sendMobileVerification's own contract
 * requires a real send failure to be surfaced (see that method's doc
 * comment) rather than swallowed.
 */
@Injectable()
export class Msg91SmsAdapter {
  private readonly logger = new Logger(Msg91SmsAdapter.name);

  constructor(private readonly configService: ConfigService) {}

  async sendVerificationCode(mobileNumber: string, code: string): Promise<void> {
    const authKey = this.configService.get<string>('MSG91_AUTH_KEY');
    const senderId = this.configService.get<string>('MSG91_SENDER_ID');
    const templateId = this.configService.get<string>('MSG91_TEMPLATE_ID_MOBILE_VERIFICATION');
    if (!authKey || !senderId || !templateId) {
      throw new Error('MSG91 is not configured (MSG91_AUTH_KEY/MSG91_SENDER_ID/MSG91_TEMPLATE_ID_MOBILE_VERIFICATION)');
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
      throw new Error(`MSG91 did not confirm delivery of the mobile-verification SMS to ${mobileNumber}`);
    }
  }
}
