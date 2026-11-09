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
import { FeedbackListScreen } from '../screens/tenant-admin-staff/FeedbackListScreen';
import { FeedbackDetailScreen } from '../screens/tenant-admin-staff/FeedbackDetailScreen';
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
  /** specs/016-feedback-management User Story 2/3 — Company Admin only. */
  FeedbackList: undefined;
  FeedbackDetail: { feedbackId: string };
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
  initialRouteName?:
    | 'Dashboard'
    | 'ProductList'
    | 'IncomingOrders'
    | 'CategoryList'
    | 'DepartmentList'
    | 'UserList'
    | 'FeedbackList';
}) {
  return (
    <Stack.Navigator initialRouteName={initialRouteName} screenOptions={secondaryHeaderOptions}>
      {/* No header title text on any screen here — the Drawer's own header (AppShell.tsx) already labels the current side-menu section next to the hamburger icon; this stack's header keeps its color/back-button but shows no duplicate text. */}
      {/* headerShown: false — DashboardScreen renders the navy AdminHeader
          itself (the artboard header has rounded bottom corners, inset
          circular controls and a second row, none of which a native
          stack header can produce). Route name and params unchanged. */}
      <Stack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: '', headerShown: false }}
      />
      <Stack.Screen
        name="UserList"
        component={UserListScreen}
        options={{ title: '', headerShown: false }}
      />
      <Stack.Screen
        name="UserCreateEdit"
        component={UserCreateEditScreen}
        options={{ title: '', headerShown: false }}
      />
      <Stack.Screen
        name="CategoryList"
        component={CategoryListScreen}
        options={{ title: '', headerShown: false }}
      />
      {/* transparentModal — the artboard floats this as a BOTTOM SHEET
          over the list, which stays visible behind a scrim. Route name
          and params are unchanged; only the presentation differs. */}
      <Stack.Screen
        name="CategoryCreateEdit"
        component={CategoryCreateEditScreen}
        options={{
          title: '',
          headerShown: false,
          presentation: 'transparentModal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="DepartmentList"
        component={DepartmentListScreen}
        options={{ title: '', headerShown: false }}
      />
      {/* transparentModal — the artboard floats this as a BOTTOM SHEET
          over the list, which stays visible behind a scrim. Route name
          and params are unchanged; only the presentation differs. */}
      <Stack.Screen
        name="DepartmentCreateEdit"
        component={DepartmentCreateEditScreen}
        options={{
          title: '',
          headerShown: false,
          presentation: 'transparentModal',
          animation: 'slide_from_bottom',
        }}
      />
      {/* headerShown: false — the screen renders the artboard's navy
          AdminPageHeader (back, title, item count, search) and a floating
          Add pill, neither of which a native stack header can carry. */}
      <Stack.Screen
        name="ProductList"
        component={ProductListScreen}
        options={{ title: '', headerShown: false }}
      />
      {/* headerShown: false — the form renders the navy AdminPageHeader with
          its own back control, matching "Company Admin · Add / edit user".
          The native bar would stack an empty navy band above it. */}
      <Stack.Screen
        name="ProductCreateEdit"
        component={ProductCreateEditScreen}
        options={{ title: '', headerShown: false }}
      />
      <Stack.Screen name="IncomingOrders" component={IncomingOrdersScreen} options={{ title: '' }} />
      <Stack.Screen name="OrderFulfilment" component={OrderFulfilmentScreen} options={{ title: '' }} />
      <Stack.Screen
        name="FeedbackList"
        component={FeedbackListScreen}
        options={{ title: '', headerShown: false }}
      />
      <Stack.Screen
        name="FeedbackDetail"
        component={FeedbackDetailScreen}
        options={{ title: '', headerShown: false }}
      />
    </Stack.Navigator>
  );
}
