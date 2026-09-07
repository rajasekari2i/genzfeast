import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { storePendingResetCode } from './pendingResetCode';

const BACKGROUND_NOTIFICATION_TASK = 'genzfeast-background-notification-task';

/**
 * specs/003-forgot-password-otp-reset User Story 3: the backend
 * (fcm-notification.adapter.ts) sends the reset code as a **data-only** FCM
 * message, never a display notification, so the app itself is what
 * surfaces it. This task handles the backgrounded/killed-app case; the
 * foreground case is handled separately by registerForegroundResetCodeListener
 * below, since a background task doesn't fire while the app is active.
 *
 * NOT verified against a real device/Firebase project in this session — the
 * shape follows Expo's documented background-notification-task pattern, but
 * actual delivery behavior (especially on iOS, which is stricter about
 * waking an app for a data-only push) needs confirming once real Firebase
 * credentials and a development build exist.
 */
TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
  if (error) {
    return;
  }
  const payload = extractPasswordResetPayload(data);
  if (payload) {
    await storePendingResetCode(payload.code);
  }
});

function extractPasswordResetPayload(data: unknown): { code: string } | null {
  const record = data as Record<string, unknown> | undefined;
  const notificationData =
    (record?.notification as Record<string, unknown> | undefined)?.data ?? record?.data ?? record;
  const parsed = notificationData as { type?: string; code?: string } | undefined;
  return parsed?.type === 'password_reset' && typeof parsed.code === 'string' ? { code: parsed.code } : null;
}

/** Call once at app startup (App.tsx). No-ops if already registered or unsupported (e.g. Expo Go). */
export async function registerPasswordResetBackgroundTask(): Promise<void> {
  try {
    await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
  } catch {
    // Expected in Expo Go, on web, or before Firebase is configured — the
    // in-app Verify screen still works via manual code entry either way.
  }
}

/** Call once at app startup (App.tsx); returns an unsubscribe function for cleanup. */
export function registerForegroundResetCodeListener(): () => void {
  const subscription = Notifications.addNotificationReceivedListener((notification) => {
    const payload = extractPasswordResetPayload(notification.request.content.data);
    if (payload) {
      void storePendingResetCode(payload.code);
    }
  });
  return () => subscription.remove();
}
