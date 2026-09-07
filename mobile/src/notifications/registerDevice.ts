import { createTypedClient, getStoredRefreshToken } from '../api/client';
import { getDevicePushToken } from './pushToken';
import type { paths } from '../api/generated/009-order-fcm-push-notifications';

const client = createTypedClient<paths>();

/**
 * specs/009-order-fcm-push-notifications FR-001/FR-003. Best-effort and
 * silent on any failure (no Firebase configured, permission denied, not
 * actually logged in yet, etc.) — the spec's own Assumptions leave the exact
 * registration trigger as a client-side detail; this is called on sign-in
 * and on app start while already logged in (AuthContext.tsx), which is
 * enough to keep a logged-in device's token current without needing a
 * background refresh job.
 */
export async function registerDeviceForPush(): Promise<void> {
  try {
    const [fcmToken, refreshToken] = await Promise.all([getDevicePushToken(), getStoredRefreshToken()]);
    if (!fcmToken || !refreshToken) {
      return;
    }
    await client.POST('/me/devices', { body: { fcm_token: fcmToken, refresh_token: refreshToken } });
  } catch {
    // Best-effort — the in-app pickup code (specs/006) never depends on this.
  }
}
