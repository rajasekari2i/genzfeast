import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { EmptyState } from '../../components/EmptyState';
import { StatusBadge } from '../../components/StatusBadge';
import { createTypedClient } from '../../api/client';
import { formatRupees } from '../../theme/money';
import { colors, radius } from '../../theme/tokens';
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
    <Screen title="My Orders">
      <View className="gap-md">
        <Text className="text-title text-text-primary">My orders</Text>

        {/* Segmented control — the artboard's pill-in-a-trough, not two
            loose chips. The count sits on the active tab. */}
        <View style={{ backgroundColor: colors.borderSoft }} className="flex-row rounded-pill p-xs">
          {(['upcoming', 'history'] as const).map((tab) => {
            const active = view === tab;
            return (
              <Pressable
                key={tab}
                onPress={() => setView(tab)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={{ backgroundColor: active ? colors.espresso : 'transparent' }}
                className="flex-1 h-touch rounded-pill items-center justify-center"
              >
                <Text className={active ? 'text-body-bold text-surface' : 'text-body text-text-body'}>
                  {tab === 'upcoming' ? 'Upcoming' : 'History'}
                  {active && orders.length > 0 ? ` · ${orders.length}` : ''}
                </Text>
              </Pressable>
            );
          })}
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
          <View className="gap-sm">
            {orders.map((order) => {
              // A placed order is the one the diner is actively waiting on,
              // so the artboard gives it the dark treatment and leaves the
              // rest on white.
              const awaiting = order.status === 'order_placed';
              const resumable = order.status === 'payment_pending' || order.status === 'payment_failed';
              return (
                <Pressable
                  key={order.id}
                  onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}
                  accessibilityRole="button"
                  style={{
                    backgroundColor: awaiting ? colors.espresso : colors.surface,
                    borderRadius: radius['5xl'],
                    borderWidth: awaiting ? 0 : 1,
                    borderColor: colors.border,
                  }}
                  className="p-md gap-sm active:opacity-80"
                >
                  <View className="flex-row items-center justify-between">
                    <Text
                      className={`text-label ${awaiting ? 'text-text-on-dark' : 'text-text-body'}`}
                      numberOfLines={1}
                    >
                      #{order.id.slice(0, 8).toUpperCase()} · {new Date(order.placed_at).toLocaleString()}
                    </Text>
                    <StatusBadge status={order.status} />
                  </View>

                  <View className="flex-row items-center justify-between">
                    <Text className={`text-subtitle ${awaiting ? 'text-surface' : 'text-text-primary'}`}>
                      {formatRupees(order.total_amount)}
                    </Text>
                    {resumable ? <Text className="text-body-bold text-link">Resume payment →</Text> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* The artboard shows each card's item list and, for a placed order,
            the pickup code inline. GET /student/orders returns only
            {id, status, total_amount, placed_at} — items and otp are on the
            DETAIL endpoint. Rendering them here would mean one extra request
            per row, which FR-032 forbids, so the card stops at the total and
            the detail screen carries the rest. */}
        {!loading && orders.length > 0 && view === 'upcoming' ? (
          <View
            style={{ borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.borderDashed }}
            className="items-center gap-xs p-md rounded-5xl"
          >
            <Text className="text-label-lg text-text-body">Delivered and failed orders live in History</Text>
            <Text className="text-caption text-text-secondary">Most recent first</Text>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
