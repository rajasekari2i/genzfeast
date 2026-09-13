import { PermissionsAndroid, Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';

/**
 * @react-native-firebase/messaging's requestPermission() has NO Android
 * implementation whatsoever (confirmed: neither PermissionsAndroid nor
 * POST_NOTIFICATIONS appears anywhere in its native or JS source) — it's an
 * iOS-only concept there, carried over from the APNs permission model.
 * Android 13+'s POST_NOTIFICATIONS runtime permission has to be requested
 * through React Native core's own PermissionsAndroid instead, or the OS
 * silently leaves notifications off with no dialog ever shown (confirmed on
 * a real device: fresh install, no prompt, Settings → Notifications
 * defaulted to off). On Android <13 (no such runtime permission exists)
 * PermissionsAndroid.request resolves to 'granted' immediately, so this is
 * safe to call unconditionally on every Android version.
 */
async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }
  const authStatus = await messaging().requestPermission();
  return isAuthorized(authStatus);
}

/**
 * Obtains this device's native FCM (Android) / APNs-backed (iOS) push
 * token, since the backend (api/src/notifications/fcm-notification.adapter.ts)
 * sends directly via firebase-admin to a real FCM registration token.
 * Requires a real Firebase project wired into this app
 * (`google-services.json` / `GoogleService-Info.plist`). Returns null if
 * permission is denied or Firebase isn't configured yet (getToken throws in
 * that case).
 */
export async function getDevicePushToken(): Promise<string | null> {
  const granted = await requestNotificationPermission();
  if (!granted) {
    return null;
  }

  try {
    return await messaging().getToken();
  } catch {
    return null;
  }
}

function isAuthorized(authStatus: number): boolean {
  return (
    authStatus === messaging.AuthorizationStatus.AUTHORIZED || authStatus === messaging.AuthorizationStatus.PROVISIONAL
  );
}

/**
 * Read-only — unlike getDevicePushToken, never triggers the OS permission
 * dialog. For screens (RegisterScreen) that want to warn the student
 * up front when notifications are off, without re-prompting on every
 * mount (Android won't show the dialog again after a real "Deny" anyway;
 * re-requesting here would be a no-op at best and a confusing repeat
 * prompt at worst).
 */
export async function areNotificationsEnabled(): Promise<boolean> {
  const authStatus = await messaging().hasPermission();
  return isAuthorized(authStatus);
}
