import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { storePendingMobileVerificationCode } from './pendingMobileVerificationCode';

/**
 * specs/014-msg91-sms-otp-mobile-verification — the FCM fallback used when
 * a Company has `is_sms=false`, or when MSG91 itself fails. Background-only:
 * `RegisterScreen.tsx` already has its own foreground `onMessage` listener
 * (kept there, not duplicated here) for the live-foreground case; this file
 * only covers the backgrounded/killed-app case, registered via
 * `setBackgroundMessageHandler` in index.ts (composed with
 * `registerBackgroundResetCodeHandler` — Firebase only allows one such
 * handler globally, unlike `onMessage`).
 *
 * NOT verified against a real device/Firebase project for the
 * backgrounded/killed case specifically in this session — same caveat
 * `passwordResetPush.ts` already carries (iOS is stricter about waking an
 * app for a data-only push).
 */
export async function registerBackgroundMobileVerificationHandler(
  message: FirebaseMessagingTypes.RemoteMessage,
): Promise<void> {
  const payload = extractMobileVerificationPayload(message.data);
  if (payload) {
    await storePendingMobileVerificationCode(payload.mobileNumber, payload.code);
  }
}

function extractMobileVerificationPayload(data: unknown): { code: string; mobileNumber: string } | null {
  const parsed = data as { type?: string; code?: string; mobile_number?: string } | undefined;
  return parsed?.type === 'mobile_verification' && typeof parsed.code === 'string' && typeof parsed.mobile_number === 'string'
    ? { code: parsed.code, mobileNumber: parsed.mobile_number }
    : null;
}
