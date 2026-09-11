import messaging from '@react-native-firebase/messaging';

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
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;
  if (!enabled) {
    return null;
  }

  try {
    return await messaging().getToken();
  } catch {
    return null;
  }
}
