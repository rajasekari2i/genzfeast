import notifee, { AndroidImportance } from '@notifee/react-native';
import messaging, { type FirebaseMessagingTypes } from '@react-native-firebase/messaging';

// specs/014-msg91-sms-otp-mobile-verification FR-007. The backend
// (fcm-notification.adapter.ts) now sends this as a visible push — FCM
// auto-displays it while the app is backgrounded/killed, but not while the
// app is in the foreground, so this file's foreground listener covers that
// gap by calling notifee directly. There's deliberately no background
// handler here anymore (nothing to do — FCM's own OS-level display already
// handles backgrounded/killed).
//
// Registered once, unconditionally, at app startup (App.tsx) — mirrors
// passwordResetPush.ts's registerForegroundResetCodeListener, and
// deliberately NOT gated on RegisterScreen's own otpStatus/otpMobileNumber
// state the way an earlier version of this was: the server sends this push
// *during* the same HTTP call that RegisterScreen awaits, so a listener
// only subscribed after that call resolves (and React re-renders) races the
// push and can miss it outright, with nothing left to catch it afterward
// now that auto-fill (and its AsyncStorage fallback) is gone. An always-on
// listener has no such window.
const CHANNEL_ID = 'mobile-verification';

/** Call once at app startup (App.tsx) — notifee's createChannel is idempotent. */
export async function ensureMobileVerificationChannel(): Promise<void> {
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Registration OTP',
    importance: AndroidImportance.HIGH,
  });
}

function isMobileVerificationMessage(message: FirebaseMessagingTypes.RemoteMessage): boolean {
  return (message.data as { type?: string } | undefined)?.type === 'mobile_verification';
}

async function displayMobileVerificationNotification(message: FirebaseMessagingTypes.RemoteMessage): Promise<void> {
  try {
    await notifee.displayNotification({
      title: message.notification?.title ?? 'GenzFeast Registration OTP',
      body: message.notification?.body ?? 'Your registration OTP has arrived.',
      android: { channelId: CHANNEL_ID, pressAction: { id: 'default' } },
    });
  } catch (error) {
    // Best-effort, like every other NotificationPort delivery path — a
    // display failure here must never crash whatever screen is mounted.
    console.warn('Failed to display mobile-verification notification', error);
  }
}

/** Call once at app startup (App.tsx); returns an unsubscribe function for cleanup. */
export function registerForegroundMobileVerificationListener(): () => void {
  return messaging().onMessage(async (message) => {
    if (isMobileVerificationMessage(message)) {
      await displayMobileVerificationNotification(message);
    }
  });
}
