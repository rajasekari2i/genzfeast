import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DrawerActions } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { Icon } from '../../components/Icon';
import { Highlight } from '../../components/AuthChrome';
import { ProductCard } from '../../components/ProductCard';
import { CartSummaryBar } from '../../components/CartSummaryBar';
import { SkeletonCard } from '../../components/SkeletonCard';
import { EmptyState } from '../../components/EmptyState';
import { createTypedClient, getCurrentUser } from '../../api/client';
import { useCart } from '../../cart/CartContext';
import { getTenantDisplayName } from '../../config/tenant';
import { colors, spacing, size } from '../../theme/tokens';
import type { StudentStackParamList } from '../../navigation/StudentNavigator';
import type { paths } from '../../api/generated/006-student-browse-cart-checkout';

type Props = NativeStackScreenProps<StudentStackParamList, 'Home'>;

const client = createTypedClient<paths>();

type Product = {
  id: string;
  name: string;
  description: string;
  image_url: string | null;
  price: number;
  is_veg: boolean;
  is_soldout: boolean;
};

/**
 * Home / menu — specs/017-ui-refresh FR-025, the `Home` artboard.
 *
 * TWO-COLUMN GRID. This screen previously mapped products inside Screen's
 * ScrollView, so there was no virtualisation to preserve — the grid
 * INTRODUCES it (research R12). Hence `scroll={false}` plus a FlatList the
 * screen owns: nesting a FlatList inside Screen's ScrollView is the
 * same-orientation anti-pattern Screen.tsx itself documents.
 *
 * The bottom inset is load-bearing. CartSummaryBar is absolutely positioned
 * over the list, so without it the final row is permanently unreachable.
 *
 * There is no pull-to-refresh here and none is added — `load()` runs once on
 * mount, exactly as before (FR-030: no behavioural change).
 *
 * No category filter and no search: Products carry no food-category concept
 * in V1, and FR-037 explicitly forbids adding search during this restyle.
 */
export function HomeScreen({ navigation }: Props) {
  const canteen = getTenantDisplayName();
  const [firstName, setFirstName] = useState<string | undefined>(undefined);
  useEffect(() => {
    void getCurrentUser().then((u) => setFirstName(u?.name?.trim().split(' ')[0]));
  }, []);
  const { quantities, setQuantity, itemCount } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await client.GET('/student/products', {});
    if (error) {
      setErrorMessage('Could not load the menu. Please try again.');
    } else {
      setProducts((data ?? []).filter((p): p is Product => Boolean(p.id && p.name)) as Product[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalInPaise = products.reduce(
    (sum, product) => sum + (quantities[product.id] ?? 0) * product.price,
    0,
  );

  // Clears the floating cart bar (control height + its own bottom offset).
  const bottomInset = size.control + spacing.lg * 2;

  return (
    <View className="flex-1 bg-background">
      <Screen title="Home" scroll={false}>
        <FlatList
          data={loading ? [] : products}
          keyExtractor={(product) => product.id}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.sm }}
          contentContainerStyle={{ gap: spacing.sm, paddingBottom: bottomInset }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View className="gap-md pb-sm">
              {/* Section 05 header: menu, a "Pickup from <canteen>" block, then
                  the My Orders and Profile circles. These scroll with the grid
                  — the artboard does not pin them. */}
              <View className="flex-row items-center gap-xs">
                <Pressable
                  onPress={() => navigation.getParent()?.dispatch(DrawerActions.openDrawer())}
                  accessibilityRole="button"
                  accessibilityLabel="Open menu"
                  style={{ borderWidth: 1, borderColor: colors.borderSoft }}
                  className="w-touch h-touch rounded-pill bg-surface items-center justify-center active:opacity-70"
                >
                  <Icon name="menu" size={20} color={colors.espresso} />
                </Pressable>
                <View className="flex-1 pl-xs">
                  <Text className="text-eyebrow text-text-secondary">PICKUP FROM</Text>
                  <Text className="text-body-bold text-text-primary" numberOfLines={1}>
                    {canteen ?? 'Your canteen'}
                  </Text>
                </View>
                <Pressable
                  onPress={() => navigation.navigate('My Orders' as never)}
                  accessibilityRole="button"
                  accessibilityLabel="My orders"
                  style={{ borderWidth: 1, borderColor: colors.borderSoft }}
                  className="w-touch h-touch rounded-pill bg-surface items-center justify-center active:opacity-70"
                >
                  <Icon name="incomingOrders" size={20} color={colors.espresso} />
                </Pressable>
                <Pressable
                  onPress={() => navigation.navigate('Profile' as never)}
                  accessibilityRole="button"
                  accessibilityLabel="Profile"
                  style={{ backgroundColor: colors.espresso }}
                  className="w-touch h-touch rounded-pill items-center justify-center active:opacity-80"
                >
                  <Text className="text-body-bold text-surface">
                    {(firstName ?? 'G').charAt(0).toUpperCase()}
                  </Text>
                </Pressable>
              </View>

              <Text className="text-display text-text-primary">
                {firstName ? `Hey ${firstName},` : 'Hey there,'}
                {'\n'}what's the<Highlight>craving?</Highlight>
              </Text>

              {errorMessage ? (
                <EmptyState icon="⚠️" title="Something went wrong" subtitle={errorMessage} />
              ) : null}
            </View>
          }
          ListEmptyComponent={
            loading ? (
              <View className="gap-sm">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </View>
            ) : errorMessage ? null : (
              <EmptyState
                icon="🍽️"
                title="Nothing here yet"
                subtitle="This canteen hasn't added any products yet."
              />
            )
          }
          renderItem={({ item: product }) => (
            <ProductCard
              productId={product.id}
              name={product.name}
              description={product.description}
              priceInPaise={product.price}
              imageUrl={product.image_url ?? undefined}
              isVeg={product.is_veg}
              soldOut={product.is_soldout}
              quantityInCart={quantities[product.id] ?? 0}
              onAdd={() => setQuantity(product.id, 1)}
              onIncrement={() => setQuantity(product.id, (quantities[product.id] ?? 0) + 1)}
              onDecrement={() => setQuantity(product.id, (quantities[product.id] ?? 0) - 1)}
            />
          )}
        />
      </Screen>

      <CartSummaryBar
        itemCount={itemCount}
        totalInPaise={totalInPaise}
        onViewCart={() => navigation.navigate('Cart')}
      />
    </View>
  );
}
