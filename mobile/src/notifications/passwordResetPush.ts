import messaging, { type FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { storePendingResetCode } from './pendingResetCode';

/**
 * specs/003-forgot-password-otp-reset User Story 3: the backend
 * (fcm-notification.adapter.ts) sends the reset code as a **data-only** FCM
 * message, never a display notification, so the app itself is what
 * surfaces it. `setBackgroundMessageHandler` (registered in index.ts, outside
 * the React tree per Firebase's own requirement) handles the
 * backgrounded/killed-app case; the foreground case is handled separately by
 * registerForegroundResetCodeListener below, since the background handler
 * doesn't fire while the app is active.
 *
 * NOT verified against a real device/Firebase project in this session — the
 * shape follows @react-native-firebase/messaging's documented
 * setBackgroundMessageHandler pattern, but actual delivery behavior
 * (especially on iOS, which is stricter about waking an app for a data-only
 * push) needs confirming once real Firebase credentials and a development
 * build exist.
 */
export async function registerBackgroundResetCodeHandler(
  message: FirebaseMessagingTypes.RemoteMessage,
): Promise<void> {
  const payload = extractPasswordResetPayload(message.data);
  if (payload) {
    await storePendingResetCode(payload.code);
  }
}

function extractPasswordResetPayload(data: unknown): { code: string } | null {
  const parsed = data as { type?: string; code?: string } | undefined;
  return parsed?.type === 'password_reset' && typeof parsed.code === 'string' ? { code: parsed.code } : null;
}

/** Call once at app startup (App.tsx); returns an unsubscribe function for cleanup. */
export function registerForegroundResetCodeListener(): () => void {
  const unsubscribe = messaging().onMessage(async (message) => {
    const payload = extractPasswordResetPayload(message.data);
    if (payload) {
      await storePendingResetCode(payload.code);
    }
  });
  return unsubscribe;
}
