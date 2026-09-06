import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DashboardScreen } from '../screens/tenant-admin-staff/DashboardScreen';
import { StaffListScreen } from '../screens/tenant-admin-staff/StaffListScreen';
import { CategoryListScreen } from '../screens/tenant-admin-staff/CategoryListScreen';
import { DepartmentListScreen } from '../screens/tenant-admin-staff/DepartmentListScreen';
import { ProductListScreen } from '../screens/tenant-admin-staff/ProductListScreen';
import { ProductCreateEditScreen } from '../screens/tenant-admin-staff/ProductCreateEditScreen';
import { IncomingOrdersScreen } from '../screens/tenant-admin-staff/IncomingOrdersScreen';
import { OrderFulfilmentScreen } from '../screens/tenant-admin-staff/OrderFulfilmentScreen';
import { primaryHeaderOptions } from '../theme/navigationHeader';

/** Tenant Admin & Staff App — Company Admin + Staff surface, UI Design §5. */
export type TenantAdminStaffStackParamList = {
  Dashboard: undefined;
  StaffList: undefined;
  CategoryList: undefined;
  DepartmentList: undefined;
  ProductList: undefined;
  ProductCreateEdit: { productId?: string };
  IncomingOrders: undefined;
  OrderFulfilment: { orderId: string };
};

const Stack = createNativeStackNavigator<TenantAdminStaffStackParamList>();

export function TenantAdminStaffNavigator() {
  return (
    <Stack.Navigator initialRouteName="Dashboard" screenOptions={primaryHeaderOptions}>
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="StaffList" component={StaffListScreen} options={{ title: 'Staff' }} />
      <Stack.Screen name="CategoryList" component={CategoryListScreen} options={{ title: 'Categories' }} />
      <Stack.Screen name="DepartmentList" component={DepartmentListScreen} options={{ title: 'Departments' }} />
      <Stack.Screen name="ProductList" component={ProductListScreen} options={{ title: 'Products' }} />
      <Stack.Screen name="ProductCreateEdit" component={ProductCreateEditScreen} options={{ title: 'Product' }} />
      <Stack.Screen name="IncomingOrders" component={IncomingOrdersScreen} options={{ title: 'Incoming Orders' }} />
      <Stack.Screen name="OrderFulfilment" component={OrderFulfilmentScreen} options={{ title: 'Order Fulfilment' }} />
    </Stack.Navigator>
  );
}
