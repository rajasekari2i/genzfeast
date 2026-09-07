import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/student/HomeScreen';
import { CartScreen } from '../screens/student/CartScreen';
import { MyOrdersScreen } from '../screens/student/MyOrdersScreen';
import { OrderDetailScreen } from '../screens/student/OrderDetailScreen';
import { primaryHeaderOptions } from '../theme/navigationHeader';

/**
 * The logged-in Student surface, UI Design §3 (minus the pre-login screens,
 * which moved to AuthNavigator once login became role-based routing rather
 * than a manually-picked app). Rendered once per side-menu entry in
 * AppShell.tsx, each with a different `initialRouteName` — Home/Cart/
 * My Orders are each their own drawer item, not sub-screens reached only by
 * pushing from Home. Profile moved out entirely (specs/007) — it's now a
 * shared side-menu item for every role, not Student-specific; see
 * ProfileNavigator.tsx / AppShell.tsx.
 */
export type StudentStackParamList = {
  Home: undefined;
  Cart: undefined;
  MyOrders: undefined;
  OrderDetail: { orderId: string };
};

const Stack = createNativeStackNavigator<StudentStackParamList>();

export function StudentNavigator({
  initialRouteName = 'Home',
}: {
  initialRouteName?: keyof StudentStackParamList;
}) {
  return (
    <Stack.Navigator initialRouteName={initialRouteName} screenOptions={primaryHeaderOptions}>
      {/* No header title text on any screen here — the Drawer's own header (AppShell.tsx) already labels the current side-menu section next to the hamburger icon; this stack's header keeps its color/back-button but shows no duplicate text. */}
      <Stack.Screen name="Home" component={HomeScreen} options={{ title: '' }} />
      <Stack.Screen name="Cart" component={CartScreen} options={{ title: '' }} />
      <Stack.Screen name="MyOrders" component={MyOrdersScreen} options={{ title: '' }} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} options={{ title: '' }} />
    </Stack.Navigator>
  );
}
