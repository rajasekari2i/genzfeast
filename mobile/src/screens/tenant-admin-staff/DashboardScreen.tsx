import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { DrawerActions } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { IconTile, SectionLabel } from '../../components/AdminList';
import { Icon } from '../../components/Icon';
import type { IconName } from '../../components/Icon';
import { AdminHeader } from '../../components/AdminHeader';
import { getTenantDisplayName } from '../../config/tenant';
import { getCurrentUser } from '../../api/client';
import { colors, radius, typography } from '../../theme/tokens';
import type { AccentName } from '../../theme/tokens';
import type { TenantAdminStaffStackParamList } from '../../navigation/TenantAdminStaffNavigator';

type Props = NativeStackScreenProps<TenantAdminStaffStackParamList, 'Dashboard'>;


type QuickLinkRoute = 'ProductList' | 'CategoryList' | 'DepartmentList' | 'UserList' | 'FeedbackList';

/**
 * The 2x2 grid, in the artboard's own order. Each entry's accent family is
 * the one the artboard uses for that tile — blue #E4ECF7/#183153 for Users,
 * sun #FFF1D6/#8A5300 for Feedback, violet #EDE7FB/#4C2E91 for Categories,
 * mint #DDF4EA/#0B6B4B for Departments — which the token set already
 * carries verbatim, so no new colours were needed.
 */
const QUICK_LINKS: ReadonlyArray<{
  label: string;
  hint: string;
  icon: IconName;
  accent: AccentName;
  route: QuickLinkRoute;
}> = [
  { label: 'Users', hint: 'Staff & students', icon: 'users', accent: 'blue', route: 'UserList' },
  { label: 'Feedback', hint: 'Review & resolve', icon: 'feedback', accent: 'sun', route: 'FeedbackList' },
  { label: 'Categories', hint: 'Student, staff types', icon: 'categories', accent: 'violet', route: 'CategoryList' },
  { label: 'Departments', hint: 'Academic depts', icon: 'departments', accent: 'mint', route: 'DepartmentList' },
];

/**
 * UI Design §5.1 — quick links to Users/Categories/Departments/Products
 * (specs/001, 004), laid out exactly as the "Company Admin · Dashboard"
 * artboard specifies: a brand hero row for Products plus a 2x2 grid of
 * Users / Feedback / Categories / Departments.
 * The artboard shows no item counts — each quick link carries a static
 * descriptive subtitle instead — so the four count queries this screen
 * used to issue on mount are gone. That is fewer requests, not more.
 * §5.1's own "canteen open/closed toggle" isn't built here — no
 * company_admin-facing endpoint exists yet for a Company Admin to toggle
 * their own Company's is_open (today that's System-Admin-only via
 * /admin/companies) — out of scope for a visual-only redesign.
 * No Incoming Orders link here: specs/005's own contract restricts every
 * /tenant/staff/orders* endpoint to the `staff` role specifically, not
 * company_admin — that surface is reached only via Staff's own side-menu
 * item (AppShell.tsx).
 */
export function DashboardScreen({ navigation }: Props) {
  const [adminName, setAdminName] = useState<string | undefined>(undefined);

  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      setAdminName(user?.name);
    })();
  }, []);

  return (
    <Screen
      surface="admin"
      title="Dashboard"
      header={
        <AdminHeader
          role="ADMIN"
          initial={(adminName || 'A').trim().charAt(0).toUpperCase()}
          onOpenMenu={() => navigation.dispatch(DrawerActions.openDrawer())}
        >
          <Text style={{ ...typography.label, color: colors.navyMuted }}>
            {[getTenantDisplayName(), 'Company Admin'].filter(Boolean).join(' \u00B7 ')}
          </Text>
          <Text style={{ ...typography.displaySm, color: colors.surface }}>
            {adminName ? `Morning, ${adminName.split(' ')[0]}.` : 'Dashboard'}
            {'\n'}What's on the menu?
          </Text>
        </AdminHeader>
      }
    >
      <View className="gap-md">
        <SectionLabel>Manage</SectionLabel>

        {/* Transcribed from the "Company Admin · Dashboard" artboard in
            docs/ui-screen/GenzFeast-Admin-and-Staff.html: a full-width brand
            row for Products (radius 26, 52px espresso tile, sun cloche
            glyph, trailing chevron), then a 2x2 grid in the artboard's own
            order — Users, Feedback, Categories, Departments — each on white
            with a 1px hairline, a 44px tile in its accent family, and a
            static descriptive subtitle.

            The artboard carries no item counts, so the per-entity count
            fetch this screen used to run is gone with them; Feedback is now
            present, which it was not before. */}
        <Pressable
          onPress={() => navigation.navigate('ProductList')}
          accessibilityRole="button"
          accessibilityLabel="Products"
          style={{ backgroundColor: colors.primary, borderRadius: radius.card }}
          className="flex-row items-center gap-md p-md active:opacity-80"
        >
          <View
            style={{ borderRadius: radius['2xl'] }}
            className="w-control h-control bg-espresso items-center justify-center"
          >
            <Icon name="cloche" size={26} color={colors.accent} />
          </View>
          <View className="flex-1 gap-glyph">
            <Text className="text-title-md text-espresso">Products</Text>
            <Text className="text-label text-espresso">Menu, prices, photos, sold-out</Text>
          </View>
          <Icon name="chevronRight" size={22} color={colors.espresso} />
        </Pressable>

        <View className="flex-row flex-wrap justify-between gap-y-sm">
          {QUICK_LINKS.map((card) => (
            <Pressable
              key={card.label}
              onPress={() => navigation.navigate(card.route)}
              accessibilityRole="button"
              accessibilityLabel={card.label}
              style={{
                width: '48%',
                borderRadius: radius['5xl'],
                borderWidth: 1,
                borderColor: colors.borderCard,
              }}
              className="bg-surface p-sm gap-lg active:opacity-80"
            >
              <IconTile icon={card.icon} accent={card.accent} size="md" />
              <View className="gap-glyph">
                <Text className="text-price text-text-primary">{card.label}</Text>
                <Text className="text-caption text-text-secondary">{card.hint}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </Screen>
  );
}
