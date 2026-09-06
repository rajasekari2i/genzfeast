import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { NavButton } from '../../components/NavButton';
import { ProductCard } from '../../components/ProductCard';
import { CategoryChip } from '../../components/CategoryChip';
import { CartSummaryBar } from '../../components/CartSummaryBar';
import { SkeletonCard } from '../../components/SkeletonCard';
import { EmptyState } from '../../components/EmptyState';
import type { StudentStackParamList } from '../../navigation/StudentNavigator';

type Props = NativeStackScreenProps<StudentStackParamList, 'Home'>;

// Sample data for visual demonstration only — specs/004 (Company Admin
// product CRUD) and specs/006 (browse/cart) don't have a built backend yet,
// so there is nothing real to fetch. Replace with a real API call once
// those modules exist; the screen's structure/state shape won't need to
// change, only where MOCK_PRODUCTS/MOCK_CATEGORIES come from.
const MOCK_CATEGORIES = ['All', 'Meals', 'Snacks', 'Beverages', 'Desserts'];

const MOCK_PRODUCTS = [
  { id: '1', name: 'Veg Thali', priceInPaise: 8900, category: 'Meals' },
  { id: '2', name: 'Paneer Roll', priceInPaise: 6500, category: 'Snacks' },
  { id: '3', name: 'Masala Chai', priceInPaise: 2000, category: 'Beverages', soldOut: true },
  { id: '4', name: 'Chocolate Brownie', priceInPaise: 4500, category: 'Desserts' },
  { id: '5', name: 'Samosa (2 pcs)', priceInPaise: 3000, category: 'Snacks' },
  { id: '6', name: 'Cold Coffee', priceInPaise: 5000, category: 'Beverages' },
];

/** UI Design §4.5 Home/Product List — product cards, ADD+ stepper, persistent cart bar (specs/006). */
export function HomeScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cart, setCart] = useState<Record<string, number>>({});

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 900);
    return () => clearTimeout(timer);
  }, []);

  const visibleProducts = useMemo(
    () =>
      selectedCategory === 'All'
        ? MOCK_PRODUCTS
        : MOCK_PRODUCTS.filter((product) => product.category === selectedCategory),
    [selectedCategory],
  );

  const itemCount = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
  const totalInPaise = MOCK_PRODUCTS.reduce(
    (sum, product) => sum + (cart[product.id] ?? 0) * product.priceInPaise,
    0,
  );

  function setQuantity(productId: string, quantity: number) {
    setCart((prev) => ({ ...prev, [productId]: Math.max(quantity, 0) }));
  }

  return (
    <View className="flex-1 bg-background">
      <Screen title="Home" subtitle="What are you craving today?" specRef="UI Design §4.5">
        <View className="flex-row flex-wrap mb-4">
          {MOCK_CATEGORIES.map((category) => (
            <CategoryChip
              key={category}
              label={category}
              selected={category === selectedCategory}
              onPress={() => setSelectedCategory(category)}
            />
          ))}
        </View>

        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : visibleProducts.length === 0 ? (
          <EmptyState
            icon="🍽️"
            title="Nothing here yet"
            subtitle="This canteen hasn't added products in this category."
          />
        ) : (
          visibleProducts.map((product) => (
            <ProductCard
              key={product.id}
              name={product.name}
              priceInPaise={product.priceInPaise}
              soldOut={product.soldOut}
              quantityInCart={cart[product.id] ?? 0}
              onAdd={() => setQuantity(product.id, 1)}
              onIncrement={() => setQuantity(product.id, (cart[product.id] ?? 0) + 1)}
              onDecrement={() => setQuantity(product.id, (cart[product.id] ?? 0) - 1)}
            />
          ))
        )}

        <View className="mt-2">
          <NavButton label="My Orders" onPress={() => navigation.navigate('MyOrders')} />
          <NavButton label="Profile" onPress={() => navigation.navigate('Profile')} />
        </View>
      </Screen>

      <CartSummaryBar
        itemCount={itemCount}
        totalInPaise={totalInPaise}
        onViewCart={() => navigation.navigate('Cart')}
      />
    </View>
  );
}
