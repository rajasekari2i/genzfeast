import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import {
  createDrawerNavigator,
  DrawerContentComponentProps,
  DrawerContentScrollView,
} from '@react-navigation/drawer';
import { StudentNavigator } from './StudentNavigator';
import { TenantAdminStaffNavigator } from './TenantAdminStaffNavigator';
import { ProfileNavigator } from './ProfileNavigator';
import { ContactUsNavigator } from './ContactUsNavigator';
import { FeedbackNavigator } from './FeedbackNavigator';
import { useAuth } from '../auth/AuthContext';
import { getTenantDisplayName } from '../config/tenant';
import { colors, radius, spacing } from '../theme/tokens';

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
function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { user, signOut } = useAuth();
  const canteen = getTenantDisplayName();
  const initial = (user?.name ?? 'G').trim().charAt(0).toUpperCase();
  const activeRoute = props.state.routeNames[props.state.index];

  return (
    <DrawerContentScrollView
      {...props}
      style={{ backgroundColor: colors.espresso }}
      contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.lg }}
    >
      {/* Brand row — "Genz" light, "Feast" in the tenant brand colour. */}
      <View className="flex-row items-center justify-between px-sm pb-md">
        <View className="flex-row items-center gap-sm">
          <View style={{ borderRadius: radius.sm }} className="w-xl h-xl overflow-hidden">
            <Image
              source={require('../../assets/brand/gf-icon-v2.png')}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
              accessibilityLabel=""
            />
          </View>
          <Text className="text-subtitle text-surface">
            Genz<Text style={{ color: colors.primary }}>Feast</Text>
          </Text>
        </View>
        <Pressable
          onPress={() => props.navigation.closeDrawer()}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
          style={{ backgroundColor: colors.espressoRaised }}
          className="w-touch h-touch rounded-pill items-center justify-center"
        >
          <Text className="text-bodyBold text-surface">✕</Text>
        </Pressable>
      </View>

      {/* Identity card — the user's NAME and their CANTEEN. Never the role
          (FR-027): the previous revision printed `user.role` here, which is
          a permission-system value, not something the user recognises. */}
      <View
        style={{ backgroundColor: colors.espressoRaised, borderRadius: radius['4xl'] }}
        className="flex-row items-center gap-sm p-sm mb-md"
      >
        <View
          style={{ backgroundColor: colors.primary }}
          className="w-field h-field rounded-pill items-center justify-center"
        >
          <Text className="text-subtitle text-espresso">{initial}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-price text-surface" numberOfLines={1}>
            {user?.name ?? 'GenzFeast'}
          </Text>
          {canteen ? (
            <Text className="text-caption text-text-on-dark" numberOfLines={1}>
              {canteen}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Menu items. The active item is brand-filled with espresso text; the
          rest are plain on the espresso panel. */}
      <View className="gap-xs">
        {props.state.routeNames.map((name) => {
          const active = name === activeRoute;
          return (
            <Pressable
              key={name}
              onPress={() => props.navigation.navigate(name)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={{
                backgroundColor: active ? colors.primary : 'transparent',
                borderRadius: radius.xl,
              }}
              className="h-control px-md flex-row items-center justify-between"
            >
              <Text className={active ? 'text-bodyBold text-espresso' : 'text-body text-surface'}>
                {name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={() => void signOut()}
        accessibilityRole="button"
        className="h-control px-md mt-md flex-row items-center"
      >
        <Text style={{ color: colors.primary }} className="text-bodyBold">
          Logout
        </Text>
      </Pressable>
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
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.espresso,
        drawerStyle: { backgroundColor: colors.espresso, width: 316 },
        drawerType: 'front',
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

      {/* specs/007-user-profile-management — common to every role (not
          Student-only, this task's own explicit ask), so it's mounted here
          unconditionally rather than inside any of the role branches above. */}
      {role ? <Drawer.Screen name="Profile" component={ProfileNavigator} /> : null}

      {/* specs/015-contact-us-page — every role in this tenant-scoped build
          (system_admin has no company and never uses this app at all — see
          RootNavigator/tenant config; this build is per-Company). This is
          also the first navigation entry point 'teaching'/'non_teaching'
          users get, beyond Profile — those roles have no other wired-up
          capability yet (CLAUDE.md). */}
      {role ? <Drawer.Screen name="Contact Us" component={ContactUsNavigator} /> : null}

      {/* specs/016-feedback-management User Story 1 — every role in this
          tenant-scoped build, same reasoning as Contact Us above. */}
      {role ? <Drawer.Screen name="Feedback" component={FeedbackNavigator} /> : null}
    </Drawer.Navigator>
  );
}
