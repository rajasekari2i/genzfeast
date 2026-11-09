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
import { Icon } from '../components/Icon';
import type { IconName } from '../components/Icon';
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
/**
 * Drawer route name -> the artboard's own glyph for that item. Taken from
 * the "Company Admin · Side menu" and "Staff · Side menu" artboards; the
 * student artboard does not carry inline glyphs in the same form, so
 * student items stay text-only rather than get invented icons.
 */
const DRAWER_ICONS: Partial<Record<string, IconName>> = {
  Dashboard: 'dashboard',
  Products: 'cloche',
  Categories: 'categories',
  Departments: 'departments',
  Users: 'users',
  'Feedback Review': 'feedbackReview',
  'Incoming Orders': 'incomingOrders',
  Profile: 'profile',
  'Contact Us': 'contactUs',
  Feedback: 'feedback',
};

/**
 * Profile / Contact Us / Feedback are added for EVERY role, after the
 * role-specific items. The artboards put a hairline exactly there, so the
 * divider is derived from that boundary rather than hardcoded by index.
 */
const UNIVERSAL_ROUTES = ['Profile', 'Contact Us', 'Feedback'];

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { user, signOut } = useAuth();
  const canteen = getTenantDisplayName();
  const initial = (user?.name ?? 'G').trim().charAt(0).toUpperCase();
  const activeRoute = props.state.routeNames[props.state.index];

  // Two grounds, in the drawer too (research R1). The artboards differ:
  // the student menu is espresso #2B1D16, the Company Admin and Staff menus
  // are navy #183153. Same structure, different palette.
  const backOffice = user?.role === 'company_admin' || user?.role === 'company_staff';
  const panel = backOffice ? colors.primaryVariant : colors.espresso;
  const raised = backOffice ? colors.navyTint : colors.espressoRaised;
  const muted = backOffice ? colors.navyMuted : colors.textOnDark;

  return (
    <DrawerContentScrollView
      {...props}
      style={{ backgroundColor: panel }}
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
          style={{ backgroundColor: raised }}
          className="w-touch h-touch rounded-pill items-center justify-center"
        >
          <Icon name="close" size={18} color={colors.surface} />
        </Pressable>
      </View>

      {/* Identity card — the user's NAME and their CANTEEN. Never the role
          (FR-027): the previous revision printed `user.role` here, which is
          a permission-system value, not something the user recognises. */}
      <View
        style={{ backgroundColor: raised, borderRadius: radius['3xl'] }}
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
            <Text style={{ color: muted }} className="text-caption" numberOfLines={1}>
              {canteen}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Menu items. The active item is brand-filled with espresso text; the
          rest are plain on the espresso panel. */}
      <View className="gap-glyph">
        {props.state.routeNames.map((name, i) => {
          const active = name === activeRoute;
          const icon = DRAWER_ICONS[name];
          // The artboards separate the role-specific items from the
          // universal ones with a 1px hairline. Render it before the first
          // universal route rather than at a fixed index, so the rule holds
          // for every role's item count.
          const startsUniversalGroup =
            UNIVERSAL_ROUTES.includes(name) && !UNIVERSAL_ROUTES.includes(props.state.routeNames[i - 1] ?? '');

          return (
            <React.Fragment key={name}>
              {startsUniversalGroup ? (
                <View
                  style={{ height: 1, backgroundColor: backOffice ? colors.navyDivider : colors.espressoRaised }}
                  className="mx-sm my-sm"
                />
              ) : null}
              <Pressable
                onPress={() => props.navigation.navigate(name)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={{
                  backgroundColor: active ? colors.primary : 'transparent',
                  borderRadius: radius.lg,
                  height: 46,
                }}
                className="px-md flex-row items-center gap-md"
              >
                {icon ? (
                  <Icon name={icon} size={20} color={active ? colors.espresso : colors.surface} />
                ) : null}
                <Text className={active ? 'text-body-bold text-espresso' : 'text-body-bold text-surface'}>
                  {name}
                </Text>
              </Pressable>
            </React.Fragment>
          );
        })}
      </View>

      {/* "<canteen> · v1" — the artboard pins this to the bottom of the
          panel. Omitted entirely when the build sets no APP_DISPLAY_NAME. */}
      {canteen ? (
        <Text
          style={{ color: backOffice ? colors.navyFooter : colors.textOnDark }}
          className="text-caption px-sm mt-md"
        >
          {canteen} · v1
        </Text>
      ) : null}

      <Pressable
        onPress={() => void signOut()}
        accessibilityRole="button"
        className="h-control px-md mt-md flex-row items-center"
      >
        <Text style={{ color: colors.primary }} className="text-body-bold">
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
        // The panel itself is painted by CustomDrawerContent (role-aware:
        // espresso for students, navy for back-of-house), so this only needs
        // to match so no seam shows at the edges, and to carry the
        // artboard's rounded right corners (border-radius: 0 32px 32px 0).
        drawerStyle: {
          backgroundColor:
            role === 'company_admin' || role === 'company_staff' ? colors.primaryVariant : colors.espresso,
          width: 316,
          borderTopRightRadius: radius['7xl'],
          borderBottomRightRadius: radius['7xl'],
        },
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
          {/* headerShown: false — this screen renders the navy AdminHeader
              itself, which carries its own drawer button. Leaving the
              drawer header on would stack a second, cream top bar above
              it (two hamburgers, two titles). */}
          <Drawer.Screen
            name="Dashboard"
            component={CompanyAdminDashboardEntry}
            options={{ headerShown: false }}
          />
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
      {/* headerShown: false — ProfileScreen owns its header row, including its
          own back control. Leaving the drawer header on stacked a second
          cream bar above it. */}
      {role ? (
        <Drawer.Screen
          name="Profile"
          component={ProfileNavigator}
          options={{ headerShown: false }}
        />
      ) : null}

      {/* specs/015-contact-us-page — every role in this tenant-scoped build
          (system_admin has no company and never uses this app at all — see
          RootNavigator/tenant config; this build is per-Company). This is
          also the first navigation entry point 'teaching'/'non_teaching'
          users get, beyond Profile — those roles have no other wired-up
          capability yet (CLAUDE.md). */}
      {role ? (
        <Drawer.Screen
          name="Contact Us"
          component={ContactUsNavigator}
          options={{ headerShown: false }}
        />
      ) : null}

      {/* specs/016-feedback-management User Story 1 — every role in this
          tenant-scoped build, same reasoning as Contact Us above. */}
      {role ? (
        <Drawer.Screen
          name="Feedback"
          component={FeedbackNavigator}
          options={{ headerShown: false }}
        />
      ) : null}
    </Drawer.Navigator>
  );
}
