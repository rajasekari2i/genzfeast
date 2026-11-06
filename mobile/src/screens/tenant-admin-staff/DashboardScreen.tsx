import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { SectionLabel } from '../../components/AdminList';
import { createTypedClient, getCurrentUser } from '../../api/client';
import { accents, colors, radius, typography } from '../../theme/tokens';
import type { TenantAdminStaffStackParamList } from '../../navigation/TenantAdminStaffNavigator';
import type { paths as ProductPaths } from '../../api/generated/004-company-admin-product-crud';
import type { paths as CorePaths } from '../../api/generated/001-company-role-user-setup';

type Props = NativeStackScreenProps<TenantAdminStaffStackParamList, 'Dashboard'>;

const productsClient = createTypedClient<ProductPaths>();
const coreClient = createTypedClient<CorePaths>();

type QuickLinkRoute = 'ProductList' | 'CategoryList' | 'DepartmentList' | 'UserList';
type CardKey = 'products' | 'categories' | 'departments' | 'users';

const CARDS: Record<CardKey, { label: string; icon: string; color: string; route: QuickLinkRoute }> = {
  products: { label: 'Products', icon: '🍽️', color: colors.primary, route: 'ProductList' },
  categories: { label: 'Categories', icon: '🎓', color: colors.secondary, route: 'CategoryList' },
  departments: { label: 'Departments', icon: '🏫', color: colors.accent, route: 'DepartmentList' },
  users: { label: 'Users', icon: '👥', color: colors.primaryVariant, route: 'UserList' },
};

/**
 * UI Design §5.1 — quick links to Users/Categories/Departments/Products
 * (specs/001, 004), redesigned from a plain stacked-button list into a
 * tappable stat-card grid (this task's own explicit ask for "a good
 * design"), each card showing a live count so the dashboard actually
 * reflects the canteen's data rather than being pure navigation chrome.
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
  const [counts, setCounts] = useState<Partial<Record<CardKey, number>>>({});
  const [loadingCounts, setLoadingCounts] = useState(true);

  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      setAdminName(user?.name);

      try {
        // limit: 1 on the paginated endpoints — only `total` is needed here,
        // not the page of items itself.
        const [products, categories, departments, users] = await Promise.all([
          productsClient.GET('/tenant/products', { params: { query: { page: 1, limit: 1 } } }),
          coreClient.GET('/tenant/categories', { params: { query: { page: 1, limit: 1 } } }),
          coreClient.GET('/tenant/departments', { params: { query: { page: 1, limit: 1 } } }),
          coreClient.GET('/tenant/users'),
        ]);
        setCounts({
          products: products.data?.total,
          categories: categories.data?.total,
          departments: departments.data?.total,
          users: users.data?.length,
        });
      } finally {
        setLoadingCounts(false);
      }
    })();
  }, []);

  return (
    <Screen surface="admin" title="Dashboard">
      <View className="gap-md">
        <View className="gap-xs">
          <Text className="text-caption text-text-secondary">Company Admin</Text>
          <Text className="text-title text-text-primary">
            {adminName ? `Morning, ${adminName.split(' ')[0]}.` : 'Dashboard'}
          </Text>
          <Text className="text-body text-text-secondary">What's on the menu?</Text>
        </View>

        <SectionLabel>Manage</SectionLabel>

        {/* Products leads as a full-width brand row — it is what a Company
            Admin opens most. The rest sit in a two-up grid.
            NOTE: the artboard also shows a Feedback card here. Feedback
            Review is already one tap away in the side menu, so adding a
            second entry point is a new affordance rather than a restyle
            and is deliberately not added. */}
        <Pressable
          onPress={() => navigation.navigate(CARDS.products.route)}
          accessibilityRole="button"
          style={{ backgroundColor: colors.primary, borderRadius: radius['5xl'] }}
          className="flex-row items-center gap-md p-md active:opacity-80"
        >
          <View
            style={{ borderRadius: radius['2xl'] }}
            className="w-control h-control bg-espresso items-center justify-center"
          >
            <Text style={{ fontSize: typography.subtitle.fontSize }}>{CARDS.products.icon}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-subtitle text-espresso">{CARDS.products.label}</Text>
            {loadingCounts ? (
              <ActivityIndicator size="small" style={{ alignSelf: 'flex-start' }} />
            ) : (
              <Text className="text-label text-espresso">
                {counts.products !== undefined
                  ? `${counts.products} ${counts.products === 1 ? 'item' : 'items'}`
                  : 'Manage'}
              </Text>
            )}
          </View>
        </Pressable>

        <View className="flex-row flex-wrap justify-between gap-y-sm">
          {(Object.keys(CARDS) as CardKey[])
            .filter((key) => key !== 'products')
            .map((key) => {
              const card = CARDS[key];
              const count = counts[key];
              return (
                <Pressable
                  key={key}
                  onPress={() => navigation.navigate(card.route)}
                  accessibilityRole="button"
                  style={{
                    width: '48%',
                    borderRadius: radius['5xl'],
                    borderWidth: 1,
                    borderColor: colors.borderSoft,
                  }}
                  className="bg-surface p-md gap-md active:opacity-80"
                >
                  <View
                    style={{ backgroundColor: accents.neutral.soft, borderRadius: radius['2xl'] }}
                    className="w-control h-control items-center justify-center"
                  >
                    <Text style={{ fontSize: typography.subtitle.fontSize }}>{card.icon}</Text>
                  </View>
                  <View>
                    <Text className="text-subtitleSm text-text-primary">{card.label}</Text>
                    {loadingCounts ? (
                      <ActivityIndicator size="small" style={{ alignSelf: 'flex-start' }} />
                    ) : (
                      <Text className="text-caption text-text-secondary">
                        {count !== undefined ? `${count} ${count === 1 ? 'item' : 'items'}` : 'Manage'}
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
        </View>
      </View>
    </Screen>
  );
}
