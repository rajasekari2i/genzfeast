import React from 'react';
import { Text, View } from 'react-native';
import {
  createDrawerNavigator,
  DrawerContentComponentProps,
  DrawerContentScrollView,
  DrawerItem,
  DrawerItemList,
} from '@react-navigation/drawer';
import { StudentNavigator } from './StudentNavigator';
import { TenantAdminStaffNavigator } from './TenantAdminStaffNavigator';
import { SystemAdminNavigator } from './SystemAdminNavigator';
import { ProfileNavigator } from './ProfileNavigator';
import { ContactUsNavigator } from './ContactUsNavigator';
import { FeedbackNavigator } from './FeedbackNavigator';
import { useAuth } from '../auth/AuthContext';
import { colors } from '../theme/tokens';

const Drawer = createDrawerNavigator();

// Each drawer item below mounts its own independent instance of the
// underlying stack at a different entry screen — not one shared instance —
// so "Home"/"Cart"/"My Orders" (or Staff's "Incoming Orders"/"Products")
// behave as genuinely separate side-menu destinations, each with its own
// back-stack, rather than tabs into a single shared history.
function StudentHomeEntry() {
  return <StudentNavigator initialRouteName="Home" />;
}
function StudentCartEntry() {
  return <StudentNavigator initialRouteName="Cart" />;
}
function StudentMyOrdersEntry() {
  return <StudentNavigator initialRouteName="MyOrders" />;
}
function StaffIncomingOrdersEntry() {
  return <TenantAdminStaffNavigator initialRouteName="IncomingOrders" />;
}
function StaffProductsEntry() {
  return <TenantAdminStaffNavigator initialRouteName="ProductList" />;
}
function CompanyAdminDashboardEntry() {
  return <TenantAdminStaffNavigator initialRouteName="Dashboard" />;
}
function CompanyAdminProductsEntry() {
  return <TenantAdminStaffNavigator initialRouteName="ProductList" />;
}
function CompanyAdminCategoriesEntry() {
  return <TenantAdminStaffNavigator initialRouteName="CategoryList" />;
}
function CompanyAdminDepartmentsEntry() {
  return <TenantAdminStaffNavigator initialRouteName="DepartmentList" />;
}
function CompanyAdminUsersEntry() {
  return <TenantAdminStaffNavigator initialRouteName="UserList" />;
}
function CompanyAdminFeedbackEntry() {
  return <TenantAdminStaffNavigator initialRouteName="FeedbackList" />;
}
function SystemAdminCompaniesEntry() {
  return <SystemAdminNavigator initialRouteName="CompanyList" />;
}
function SystemAdminUsersEntry() {
  return <SystemAdminNavigator initialRouteName="UserList" />;
}

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { user, signOut } = useAuth();

  return (
    <DrawerContentScrollView {...props}>
      <View className="px-4 pb-4 mb-2 border-b border-border">
        <Text className="text-h2 text-text-primary">{user?.name ?? 'GenzFeast'}</Text>
        <Text className="text-caption text-text-secondary">{user?.role}</Text>
      </View>
      <DrawerItemList {...props} />
      <DrawerItem label="Logout" onPress={() => void signOut()} labelStyle={{ color: colors.primary }} />
    </DrawerContentScrollView>
  );
}

/**
 * The single, role-based post-login shell — one app, not separate apps per
 * role (this task's own requirement). Which drawer items appear is derived
 * purely from the logged-in user's `role` claim; every role's underlying
 * screens are otherwise unchanged from before this shell existed.
 */
export function AppShell() {
  const { user } = useAuth();
  const role = user?.role;

  return (
    <Drawer.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.surface,
      }}
      drawerContent={(props) => <CustomDrawerContent {...props} />}
    >
      {role === 'student' && (
        <>
          <Drawer.Screen name="Home" component={StudentHomeEntry} options={{ title: 'GenzFeast' }} />
          <Drawer.Screen name="Cart" component={StudentCartEntry} />
          <Drawer.Screen name="My Orders" component={StudentMyOrdersEntry} />
        </>
      )}

      {role === 'company_staff' && (
        <>
          {/* UI Design §5.6/§5.7 — Incoming Orders + OTP verification, the
              screen a Staff login needs immediately (this task's own ask). */}
          <Drawer.Screen name="Incoming Orders" component={StaffIncomingOrdersEntry} />
          {/* UI Design §5.5 — same Product list as Company Admin's, but
              read/toggle-only (ProductListScreen itself checks the role). */}
          <Drawer.Screen name="Products" component={StaffProductsEntry} />
        </>
      )}

      {role === 'company_admin' && (
        <>
          <Drawer.Screen name="Dashboard" component={CompanyAdminDashboardEntry} />
          <Drawer.Screen name="Products" component={CompanyAdminProductsEntry} />
          {/* The registrant-affiliation Category (Student/Teaching Staff/
              Non-Teaching Staff) — not a food/product classification
              (CLAUDE.md's "Category vs Department vs Role" note). */}
          <Drawer.Screen name="Categories" component={CompanyAdminCategoriesEntry} />
          <Drawer.Screen name="Departments" component={CompanyAdminDepartmentsEntry} />
          {/* "Users" replaces the old "Staff" side-menu concept — this
              task's own explicit ask. */}
          <Drawer.Screen name="Users" component={CompanyAdminUsersEntry} />
          {/* specs/016-feedback-management User Story 2/3 — the review/
              resolve queue is Company-Admin-only; Company Staff never gets
              this entry point (spec Assumptions). */}
          <Drawer.Screen name="Feedback Review" component={CompanyAdminFeedbackEntry} />
        </>
      )}

      {role === 'system_admin' && (
        <>
          <Drawer.Screen name="Companies" component={SystemAdminCompaniesEntry} />
          <Drawer.Screen name="Users" component={SystemAdminUsersEntry} />
        </>
      )}

      {/* specs/007-user-profile-management — common to every role (not
          Student-only, this task's own explicit ask), so it's mounted here
          unconditionally rather than inside any of the role branches above. */}
      {role ? <Drawer.Screen name="Profile" component={ProfileNavigator} /> : null}

      {/* specs/015-contact-us-page — every tenant role EXCEPT system_admin
          (spec Assumptions: System Admin manages this data, it isn't a
          viewer of the page itself). This is also the first navigation
          entry point 'teaching'/'non_teaching' users get, beyond Profile —
          those roles have no other wired-up capability yet (CLAUDE.md). */}
      {role && role !== 'system_admin' ? <Drawer.Screen name="Contact Us" component={ContactUsNavigator} /> : null}

      {/* specs/016-feedback-management User Story 1 — every tenant role
          EXCEPT system_admin (spec Assumptions: System Admin has no
          feedback surface in this feature), same condition as Contact Us
          above. */}
      {role && role !== 'system_admin' ? <Drawer.Screen name="Feedback" component={FeedbackNavigator} /> : null}
    </Drawer.Navigator>
  );
}
