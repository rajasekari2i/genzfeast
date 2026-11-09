import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { EmptyState } from '../../components/EmptyState';
import { colors, radius } from '../../theme/tokens';
import { createTypedClient } from '../../api/client';
import { formatRupees } from '../../theme/money';
import type { TenantAdminStaffStackParamList } from '../../navigation/TenantAdminStaffNavigator';
import type { paths } from '../../api/generated/005-staff-order-fulfilment-otp';

type Props = NativeStackScreenProps<TenantAdminStaffStackParamList, 'IncomingOrders'>;

const client = createTypedClient<paths>();

type OrderSummary = {
  id: string;
  reference: string;
  item_count: number;
  total_amount: number;
  placed_at: string;
};

/** UI Design §5.6 — order id, item count, total, time placed, tap to open (specs/005). */
export function IncomingOrdersScreen({ navigation }: Props) {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await client.GET('/tenant/staff/orders', {});
    if (error) {
      setErrorMessage('Could not load incoming orders.');
    } else {
      setOrders((data ?? []).filter((o): o is OrderSummary => Boolean(o.id && o.reference)));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    // SC-001: reappear without a manual refresh beyond normal app use —
    // simplest implementation is reloading on focus (covers "opened this
    // screen again after a new order arrived"), rather than a persistent
    // poll/websocket, which this spec leaves as an implementation detail.
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation, load]);

  return (
    <Screen surface="admin" title="Incoming Orders" specRef="UI Design §5.6">
      <View className="gap-sm">
        {errorMessage ? <Text className="text-body text-red-strong">{errorMessage}</Text> : null}

        {loading ? (
          <ActivityIndicator />
        ) : orders.length === 0 ? (
          <EmptyState icon="🧾" title="No incoming orders" subtitle="New paid orders will show up here." />
        ) : (
          orders.map((order) => (
            <Pressable
              key={order.id}
              onPress={() => navigation.navigate('OrderFulfilment', { orderId: order.id })}
              accessibilityRole="button"
              style={{ borderRadius: radius['3xl'], borderWidth: 1, borderColor: colors.borderSoft }}
              className="bg-surface p-md gap-xs active:opacity-80"
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-subtitle text-text-primary">{order.reference}</Text>
                <Text className="text-subtitle text-text-primary">{formatRupees(order.total_amount)}</Text>
              </View>
              <Text className="text-caption text-text-secondary">
                {order.item_count} item{order.item_count === 1 ? '' : 's'} · placed{' '}
                {new Date(order.placed_at).toLocaleTimeString()}
              </Text>
              {/* Oldest first — first-in-first-served at the counter. */}
            </Pressable>
          ))
        )}
      </View>
    </Screen>
  );
}
