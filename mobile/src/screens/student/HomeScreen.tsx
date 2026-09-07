import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { ProductCard } from '../../components/ProductCard';
import { CartSummaryBar } from '../../components/CartSummaryBar';
import { SkeletonCard } from '../../components/SkeletonCard';
import { EmptyState } from '../../components/EmptyState';
import { createTypedClient } from '../../api/client';
import { useCart } from '../../cart/CartContext';
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
 * UI Design §4.5 Home/Product List — product cards, ADD+ stepper, persistent
 * cart bar. Wired to real `GET /student/products` (specs/006); the category
 * filter row from the earlier mock version is dropped — specs/004's own
 * Assumptions are explicit that Products carry no food-category
 * classification in V1, so there was nothing real to filter by.
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

  const totalInPaise = products.reduce((sum, product) => sum + (quantities[product.id] ?? 0) * product.price, 0);

  return (
    <View className="flex-1 bg-background">
      <Screen title="Home" subtitle="What are you craving today?" specRef="UI Design §4.5">
        {errorMessage ? <EmptyState icon="⚠️" title="Something went wrong" subtitle={errorMessage} /> : null}

        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : products.length === 0 && !errorMessage ? (
          <EmptyState icon="🍽️" title="Nothing here yet" subtitle="This canteen hasn't added any products yet." />
        ) : (
          products.map((product) => (
            <ProductCard
              key={product.id}
              name={product.name}
              priceInPaise={product.price}
              imageUrl={product.image_url ?? undefined}
              soldOut={product.is_soldout}
              quantityInCart={quantities[product.id] ?? 0}
              onAdd={() => setQuantity(product.id, 1)}
              onIncrement={() => setQuantity(product.id, (quantities[product.id] ?? 0) + 1)}
              onDecrement={() => setQuantity(product.id, (quantities[product.id] ?? 0) - 1)}
            />
          ))
        )}
      </Screen>

      <CartSummaryBar itemCount={itemCount} totalInPaise={totalInPaise} onViewCart={() => navigation.navigate('Cart')} />
    </View>
  );
}
