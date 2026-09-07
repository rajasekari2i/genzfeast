import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

/**
 * Obtains this device's native FCM (Android) / APNs (iOS) push token — NOT
 * an Expo push token — since the backend
 * (api/src/notifications/fcm-notification.adapter.ts) sends directly via
 * firebase-admin to a real FCM registration token, never through Expo's own
 * push relay service. Requires a real Firebase project wired into this app
 * (app.json's googleServicesFile entries) and a development/production
 * build — Expo Go cannot obtain a real FCM token. Returns null on a
 * simulator/emulator, if permission is denied, or if Firebase isn't
 * configured yet (getDevicePushTokenAsync throws in that case).
 */
export async function getDevicePushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  try {
    const token = await Notifications.getDevicePushTokenAsync();
    return token.data;
  } catch {
    return null;
  }
}
