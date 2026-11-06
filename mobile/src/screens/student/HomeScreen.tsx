import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { ProductCard } from '../../components/ProductCard';
import { CartSummaryBar } from '../../components/CartSummaryBar';
import { SkeletonCard } from '../../components/SkeletonCard';
import { EmptyState } from '../../components/EmptyState';
import { createTypedClient } from '../../api/client';
import { useCart } from '../../cart/CartContext';
import { spacing, size } from '../../theme/tokens';
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
            errorMessage ? (
              <EmptyState icon="⚠️" title="Something went wrong" subtitle={errorMessage} />
            ) : null
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
