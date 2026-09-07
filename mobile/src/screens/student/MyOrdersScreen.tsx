import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { EmptyState } from '../../components/EmptyState';
import { StatusBadge } from '../../components/StatusBadge';
import { CategoryChip } from '../../components/CategoryChip';
import { createTypedClient } from '../../api/client';
import { formatRupees } from '../../theme/money';
import type { OrderStatus } from '../../theme/statusColors';
import type { StudentStackParamList } from '../../navigation/StudentNavigator';
import type { paths } from '../../api/generated/008-my-orders-history-upcoming';

type Props = NativeStackScreenProps<StudentStackParamList, 'MyOrders'>;

const client = createTypedClient<paths>();

type Order = { id: string; status: OrderStatus; total_amount: number; placed_at: string };
type OrdersView = 'upcoming' | 'history';

/**
 * UI Design §4.13 — Upcoming / History tabs (specs/008), both backed by the
 * same `GET /student/orders?view=...` (specs/006's endpoint, extended —
 * research.md §1: one endpoint filtered by a query param, not two routes).
 * Both views sort most-recently-placed-first, already the server's default.
 */
export function MyOrdersScreen({ navigation }: Props) {
  const [view, setView] = useState<OrdersView>('upcoming');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (currentView: OrdersView) => {
    setLoading(true);
    const { data, error } = await client.GET('/student/orders', { params: { query: { view: currentView } } });
    if (!error && data) {
      setOrders((data ?? []).filter((o): o is Order => Boolean(o.id && o.status)) as Order[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => load(view));
    return unsubscribe;
  }, [navigation, load, view]);

  return (
    <Screen title="My Orders" specRef="UI Design §4.13">
      <View className="flex-row mb-3">
        <CategoryChip label="Upcoming" selected={view === 'upcoming'} onPress={() => setView('upcoming')} />
        <CategoryChip label="History" selected={view === 'history'} onPress={() => setView('history')} />
      </View>

      {loading ? (
        <ActivityIndicator />
      ) : orders.length === 0 ? (
        <EmptyState
          icon="🧾"
          title={view === 'upcoming' ? 'No upcoming orders' : 'No past orders'}
          subtitle={
            view === 'upcoming'
              ? "Orders you're waiting on will show up here."
              : 'Delivered and failed-payment orders will show up here.'
          }
        />
      ) : (
        orders.map((order) => (
          <Pressable
            key={order.id}
            onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}
            accessibilityRole="button"
            className="bg-surface border border-border rounded-md p-4 mb-3 active:opacity-80"
          >
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-h2 text-text-primary">{order.id.slice(0, 8).toUpperCase()}</Text>
              <StatusBadge status={order.status} />
            </View>
            <Text className="text-caption text-text-secondary">{new Date(order.placed_at).toLocaleString()}</Text>
            <Text className="text-price text-text-primary mt-1">{formatRupees(order.total_amount)}</Text>
          </Pressable>
        ))
      )}
    </Screen>
  );
}
