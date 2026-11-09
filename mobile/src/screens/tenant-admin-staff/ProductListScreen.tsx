import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, Switch, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { RowActionButton } from '../../components/RowActionButton';
import { SwitchRow } from '../../components/SwitchRow';
import { DietaryMark } from '../../components/DietaryMark';
import { productTint } from '../../theme/accents';
import { createTypedClient, getCurrentUser } from '../../api/client';
import { formatRupees } from '../../theme/money';
import { colors, radius } from '../../theme/tokens';
import type { TenantAdminStaffStackParamList } from '../../navigation/TenantAdminStaffNavigator';
import type { paths } from '../../api/generated/004-company-admin-product-crud';

type Props = NativeStackScreenProps<TenantAdminStaffStackParamList, 'ProductList'>;

const client = createTypedClient<paths>();
const PAGE_LIMIT = 10;
const SEARCH_DEBOUNCE_MS = 300;

type Product = {
  id: string;
  name: string;
  price: number;
  is_veg: boolean;
  is_soldout: boolean;
  image_url: string | null;
};

/**
 * UI Design §5.2 (Company Admin: image/name/price/veg icon/sold-out toggle/
 * edit) and §5.5 (Staff: same list, read+toggle-only — no create/edit/
 * remove). Role comes from the stored session (client.ts's getCurrentUser),
 * since no navigator-level role gating exists yet for this stack.
 *
 * Server-side pagination (this task's own explicit ask): fetches 10 at a
 * time, appending the next page on scroll (FlatList onEndReached) rather
 * than a client-side-filtered full fetch, the way CompanyListScreen/
 * UserListScreen do — search is server-side too, since the full list is no
 * longer available locally to filter.
 */
export function ProductListScreen({ navigation }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [isCompanyAdmin, setIsCompanyAdmin] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const pageRef = useRef(1);
  const searchRef = useRef('');

  const loadPage = useCallback(async (page: number, search: string, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setErrorMessage(null);

    const { data, error } = await client.GET('/tenant/products', {
      params: { query: { page, limit: PAGE_LIMIT, ...(search && { search }) } },
    });
    if (error) {
      setErrorMessage((error as { message?: string })?.message ?? 'Could not load products.');
    } else if (data) {
      const items = (data.items ?? []).filter((p): p is Product => Boolean(p.id && p.name)) as Product[];
      setProducts((prev) => (append ? [...prev, ...items] : items));
      setHasMore(page * (data.limit ?? PAGE_LIMIT) < (data.total ?? 0));
      pageRef.current = page;
    }
    if (append) setLoadingMore(false);
    else setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      setIsCompanyAdmin(user?.role === 'company_admin');
    })();
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerRight: isCompanyAdmin
        ? () => (
            <Pressable onPress={() => navigation.navigate('ProductCreateEdit', {})} hitSlop={8}>
              <Text style={{ color: colors.surface }} className="text-button">+ Add</Text>
            </Pressable>
          )
        : undefined,
    });
  }, [navigation, isCompanyAdmin]);

  // Debounced — resets to page 1 on every settled search-query change.
  useEffect(() => {
    const handle = setTimeout(() => {
      searchRef.current = searchQuery.trim();
      loadPage(1, searchRef.current, false);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchQuery, loadPage]);

  useFocusEffect(
    useCallback(() => {
      loadPage(1, searchRef.current, false);
    }, [loadPage]),
  );

  function handleEndReached() {
    if (!hasMore || loadingMore || loading) return;
    loadPage(pageRef.current + 1, searchRef.current, true);
  }

  async function handleToggleSoldout(product: Product) {
    setBusyId(product.id);
    setErrorMessage(null);
    const { error } = await client.PATCH('/tenant/products/{productId}/soldout', {
      params: { path: { productId: product.id } },
      body: { is_soldout: !product.is_soldout },
    });
    if (error) {
      setErrorMessage((error as { message?: string })?.message ?? 'Could not update sold-out status.');
    } else {
      setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, is_soldout: !p.is_soldout } : p)));
    }
    setBusyId(null);
  }

  async function handleRemove(productId: string) {
    setBusyId(productId);
    setErrorMessage(null);
    const { error } = await client.DELETE('/tenant/products/{productId}', {
      params: { path: { productId } },
    });
    if (error) {
      setErrorMessage((error as { message?: string })?.message ?? 'Could not remove product.');
    } else {
      setProducts((prev) => prev.filter((p) => p.id !== productId));
    }
    setBusyId(null);
  }

  return (
    <Screen surface="admin" title="Products" specRef="UI Design §5.2 / §5.5" scroll={false}>
      <View className="gap-3 mb-3">
        <TextInput
          className="border border-border rounded-lg px-3 py-2 text-text-primary"
          placeholder="Search by name"
          autoCapitalize="none"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        {errorMessage ? <Text className="text-body text-red-strong">{errorMessage}</Text> : null}
      </View>

      {loading ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          className="flex-1"
          contentContainerStyle={{ gap: 10 }}
          data={products}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <Text className="text-body text-text-secondary text-center mt-8">
              {searchQuery ? 'No products match your search.' : 'No products yet. Tap + Add to create one.'}
            </Text>
          }
          onEndReachedThreshold={0.5}
          onEndReached={handleEndReached}
          ListFooterComponent={loadingMore ? <ActivityIndicator className="my-3" /> : null}
          renderItem={({ item: product }) => (
              <View
                style={{ borderRadius: radius['4xl'], borderWidth: 1, borderColor: colors.borderSoft }}
                className="flex-row items-center gap-sm bg-surface p-sm"
              >
                {product.image_url ? (
                  <Image
                    source={{ uri: product.image_url }}
                    style={{ borderRadius: radius.xl }}
                    className="w-control h-control"
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={{ backgroundColor: productTint(product.id), borderRadius: radius.xl }}
                    className="w-control h-control items-center justify-center"
                  >
                    <Text>🍽️</Text>
                  </View>
                )}
                <View className="flex-1 gap-xs">
                  <View className="flex-row items-center gap-xs">
                    {/* Shape as well as colour (FR-005) — the previous
                        coloured circles were colour-only. */}
                    <DietaryMark isVeg={product.is_veg} />
                    <Text className="flex-1 text-body-bold text-text-primary" numberOfLines={1}>
                      {product.name}
                    </Text>
                  </View>
                  <Text className="text-price text-text-primary">{formatRupees(product.price)}</Text>
                </View>
                {/* FR-019: the sold-out control. State is conveyed by the
                    switch POSITION and by its label, never colour alone —
                    staff read this at speed under canteen lighting. For
                    Staff this is the ONLY control on the row; Company Admin
                    additionally gets edit/delete below. */}
                <SwitchRow
                  compact
                  label={`${product.name} availability`}
                  value={!product.is_soldout}
                  onValueChange={() => handleToggleSoldout(product)}
                  disabled={busyId === product.id}
                  onLabel="Available"
                  offLabel="Sold Out"
                />
                {isCompanyAdmin ? (
                  <View className="items-end gap-2">
                    <RowActionButton
                      variant="edit"
                      label={`Edit ${product.name}`}
                      onPress={() => navigation.navigate('ProductCreateEdit', { productId: product.id })}
                    />
                    <RowActionButton
                      variant="delete"
                      label={`Delete ${product.name}`}
                      loading={busyId === product.id}
                      onPress={() => handleRemove(product.id)}
                    />
                  </View>
                ) : null}
              </View>
            )}
        />
      )}
    </Screen>
  );
}
