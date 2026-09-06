import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { EmptyState } from '../../components/EmptyState';
import { StatusBadge } from '../../components/StatusBadge';
import { formatRupees } from '../../theme/money';
import type { OrderStatus } from '../../theme/statusColors';
import type { StudentStackParamList } from '../../navigation/StudentNavigator';

type Props = NativeStackScreenProps<StudentStackParamList, 'MyOrders'>;

// Sample data for visual demonstration only — specs/008 (My Orders) has no
// built backend yet. Deliberately includes one of each order status so
// StatusBadge's full color+label set is visible on this screen.
const MOCK_ORDERS: { id: string; itemsSummary: string; totalInPaise: number; status: OrderStatus }[] = [
  { id: 'ord-1', itemsSummary: 'Veg Thali, Cold Coffee', totalInPaise: 13900, status: 'order_placed' },
  { id: 'ord-2', itemsSummary: 'Paneer Roll', totalInPaise: 6500, status: 'payment_pending' },
  { id: 'ord-3', itemsSummary: 'Samosa (2 pcs), Masala Chai', totalInPaise: 5000, status: 'payment_failed' },
  { id: 'ord-4', itemsSummary: 'Chocolate Brownie', totalInPaise: 4500, status: 'delivered' },
];

/** UI Design §4.13 — Upcoming / History tabs (specs/008). */
export function MyOrdersScreen({ navigation }: Props) {
  return (
    <Screen title="My Orders" subtitle="Upcoming / History" specRef="UI Design §4.13">
      {MOCK_ORDERS.length === 0 ? (
        <EmptyState icon="🧾" title="No orders yet" subtitle="Your placed orders will show up here." />
      ) : (
        MOCK_ORDERS.map((order) => (
          <Pressable
            key={order.id}
            onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}
            accessibilityRole="button"
            className="bg-surface border border-border rounded-md p-4 mb-3 active:opacity-80"
          >
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-h2 text-text-primary">{order.id}</Text>
              <StatusBadge status={order.status} />
            </View>
            <Text className="text-body text-text-secondary" numberOfLines={1}>
              {order.itemsSummary}
            </Text>
            <Text className="text-price text-text-primary mt-1">{formatRupees(order.totalInPaise)}</Text>
          </Pressable>
        ))
      )}
    </Screen>
  );
}
