import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DashboardScreen } from '../screens/tenant-admin-staff/DashboardScreen';
import { UserListScreen } from '../screens/tenant-admin-staff/UserListScreen';
import { UserCreateEditScreen } from '../screens/tenant-admin-staff/UserCreateEditScreen';
import { CategoryListScreen } from '../screens/tenant-admin-staff/CategoryListScreen';
import { CategoryCreateEditScreen } from '../screens/tenant-admin-staff/CategoryCreateEditScreen';
import { DepartmentListScreen } from '../screens/tenant-admin-staff/DepartmentListScreen';
import { DepartmentCreateEditScreen } from '../screens/tenant-admin-staff/DepartmentCreateEditScreen';
import { ProductListScreen } from '../screens/tenant-admin-staff/ProductListScreen';
import { ProductCreateEditScreen } from '../screens/tenant-admin-staff/ProductCreateEditScreen';
import { IncomingOrdersScreen } from '../screens/tenant-admin-staff/IncomingOrdersScreen';
import { OrderFulfilmentScreen } from '../screens/tenant-admin-staff/OrderFulfilmentScreen';
import { secondaryHeaderOptions } from '../theme/navigationHeader';

/** Tenant Admin & Staff App — Company Admin + Staff surface, UI Design §5. */
export type TenantAdminStaffStackParamList = {
  Dashboard: undefined;
  UserList: undefined;
  UserCreateEdit: { userId?: string };
  /** The registrant-affiliation Category (Student/Teaching Staff/Non-Teaching Staff) — the side menu's own "Categories" item. NOT a food/product classification (CLAUDE.md's "Category vs Department vs Role" note). */
  CategoryList: undefined;
  CategoryCreateEdit: { categoryId?: string };
  DepartmentList: undefined;
  DepartmentCreateEdit: { departmentId?: string };
  ProductList: undefined;
  ProductCreateEdit: { productId?: string };
  IncomingOrders: undefined;
  OrderFulfilment: { orderId: string };
};

const Stack = createNativeStackNavigator<TenantAdminStaffStackParamList>();

/**
 * `initialRouteName` lets AppShell.tsx mount this same stack at a different
 * entry point per side-menu item — e.g. Staff's "Incoming Orders" menu item
 * opens straight into IncomingOrders, skipping Dashboard entirely, since a
 * Staff login has no Dashboard access at all (Company-Admin-only screens
 * stay reachable only from Company Admin's own side-menu items, which mount
 * this stack at Dashboard/Products/Categories/Departments/Users).
 */
export function TenantAdminStaffNavigator({
  initialRouteName = 'Dashboard',
}: {
  /** Only the no-required-params entry points AppShell.tsx actually mounts this stack at. */
  initialRouteName?: 'Dashboard' | 'ProductList' | 'IncomingOrders' | 'CategoryList' | 'DepartmentList' | 'UserList';
}) {
  return (
    <Stack.Navigator initialRouteName={initialRouteName} screenOptions={secondaryHeaderOptions}>
      {/* No header title text on any screen here — the Drawer's own header (AppShell.tsx) already labels the current side-menu section next to the hamburger icon; this stack's header keeps its color/back-button but shows no duplicate text. */}
      <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: '' }} />
      <Stack.Screen name="UserList" component={UserListScreen} options={{ title: '' }} />
      <Stack.Screen name="UserCreateEdit" component={UserCreateEditScreen} options={{ title: '' }} />
      <Stack.Screen name="CategoryList" component={CategoryListScreen} options={{ title: '' }} />
      <Stack.Screen name="CategoryCreateEdit" component={CategoryCreateEditScreen} options={{ title: '' }} />
      <Stack.Screen name="DepartmentList" component={DepartmentListScreen} options={{ title: '' }} />
      <Stack.Screen name="DepartmentCreateEdit" component={DepartmentCreateEditScreen} options={{ title: '' }} />
      <Stack.Screen name="ProductList" component={ProductListScreen} options={{ title: '' }} />
      <Stack.Screen name="ProductCreateEdit" component={ProductCreateEditScreen} options={{ title: '' }} />
      <Stack.Screen name="IncomingOrders" component={IncomingOrdersScreen} options={{ title: '' }} />
      <Stack.Screen name="OrderFulfilment" component={OrderFulfilmentScreen} options={{ title: '' }} />
    </Stack.Navigator>
  );
}
