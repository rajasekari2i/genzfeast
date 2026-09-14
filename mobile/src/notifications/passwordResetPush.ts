import notifee, { AndroidImportance } from '@notifee/react-native';
import messaging, { type FirebaseMessagingTypes } from '@react-native-firebase/messaging';

/**
 * specs/003-forgot-password-otp-reset (revised): the backend
 * (fcm-notification.adapter.ts) sends the reset code as a visible push when
 * the user's Company has `is_sms=false` — FCM auto-displays it while the
 * app is backgrounded/killed, but not while the app is in the foreground,
 * so this file's foreground listener covers that gap by calling notifee
 * directly, exactly mirroring mobileVerificationPush.ts. There is
 * deliberately no background handler here anymore (nothing to do — FCM's
 * own OS-level display already handles backgrounded/killed) and no
 * AsyncStorage-based auto-fill: the user reads the code off the
 * notification (or, when their Company has `is_sms=true`, off the SMS
 * instead) and types it into ForgotPasswordVerifyScreen themselves, the
 * same way registration's own OTP already works.
 */
const CHANNEL_ID = 'password-reset';

/** Call once at app startup (App.tsx) — notifee's createChannel is idempotent. */
export async function ensurePasswordResetChannel(): Promise<void> {
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Password Reset',
    importance: AndroidImportance.HIGH,
  });
}

function isPasswordResetMessage(message: FirebaseMessagingTypes.RemoteMessage): boolean {
  return (message.data as { type?: string } | undefined)?.type === 'password_reset';
}

async function displayPasswordResetNotification(message: FirebaseMessagingTypes.RemoteMessage): Promise<void> {
  try {
    await notifee.displayNotification({
      title: message.notification?.title ?? 'GenzFeast Password Reset',
      body: message.notification?.body ?? 'Your password reset code has arrived.',
      android: { channelId: CHANNEL_ID, pressAction: { id: 'default' } },
    });
  } catch (error) {
    // Best-effort, like every other NotificationPort display path — a
    // display failure here must never crash whatever screen is mounted.
    console.warn('Failed to display password-reset notification', error);
  }
}

/** Call once at app startup (App.tsx); returns an unsubscribe function for cleanup. */
export function registerForegroundResetCodeListener(): () => void {
  return messaging().onMessage(async (message) => {
    if (isPasswordResetMessage(message)) {
      await displayPasswordResetNotification(message);
    }
  });
}
