import * as Notifications from 'expo-notifications';
import { navigationRef } from '../navigation/navigationRef';

/**
 * specs/009-order-fcm-push-notifications FR-007/User Story 3 — tapping the
 * order-ready notification (a visible one, unlike 003's data-only
 * password-reset push) opens that specific order's detail. Deep-links
 * through the Drawer's "My Orders" entry into its nested Stack, per React
 * Navigation's own nested-navigator convention (`{screen, params}`) — not
 * verified against a real device/Firebase project in this session, same
 * caveat as passwordResetPush.ts.
 */
export function registerOrderNotificationTapListener(): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as
      | { type?: string; order_id?: string }
      | undefined;
    if (data?.type === 'order_ready' && data.order_id && navigationRef.isReady()) {
      // React Navigation's ref-based cross-navigator "navigate into a nested
      // stack" call has no precise static type for an untyped root ref —
      // this is the standard escape hatch for exactly this pattern.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (navigationRef.navigate as any)('My Orders', { screen: 'OrderDetail', params: { orderId: data.order_id } });
    }
  });
  return () => subscription.remove();
}
