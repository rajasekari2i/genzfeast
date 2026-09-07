import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { createTypedClient, getCurrentUser } from '../../api/client';
import { colors } from '../../theme/tokens';
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
    <Screen title="Dashboard" subtitle="Company Admin" specRef="UI Design §5.1">
      <Text className="text-h1 text-text-primary mb-1">
        {adminName ? `Welcome back, ${adminName.split(' ')[0]}` : 'Dashboard'}
      </Text>
      <Text className="text-body text-text-secondary mb-5">Manage your canteen from here.</Text>

      <View className="flex-row flex-wrap justify-between gap-y-3">
        {(Object.keys(CARDS) as CardKey[]).map((key) => {
          const card = CARDS[key];
          const count = counts[key];
          return (
            <Pressable
              key={key}
              onPress={() => navigation.navigate(card.route)}
              className="bg-surface rounded-lg p-4 border border-border active:opacity-80"
              style={{ width: '48%' }}
            >
              <View
                className="w-12 h-12 rounded-full items-center justify-center mb-3"
                style={{ backgroundColor: `${card.color}1F` }}
              >
                <Text style={{ fontSize: 22 }}>{card.icon}</Text>
              </View>
              <Text className="text-body-bold text-text-primary">{card.label}</Text>
              {loadingCounts ? (
                <ActivityIndicator size="small" style={{ alignSelf: 'flex-start', marginTop: 6 }} />
              ) : (
                <Text className="text-caption text-text-secondary mt-1">
                  {count !== undefined ? `${count} ${count === 1 ? 'item' : 'items'}` : 'Manage'}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}
