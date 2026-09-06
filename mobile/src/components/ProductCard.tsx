import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { PrimaryButton } from './PrimaryButton';
import { formatRupees } from '../theme/money';

// Image-forward product card — specs/013-blue-theme-visual-design FR-005.
// Used on the Student Home/Product List screen. Shows either a simple ADD
// button (quantityInCart is 0/undefined) or a compact +/- stepper once at
// least one unit is in the cart, per FR-005's "clear ADD/stepper control".
export function ProductCard({
  name,
  priceInPaise,
  imageUrl,
  soldOut = false,
  quantityInCart = 0,
  onAdd,
  onIncrement,
  onDecrement,
}: {
  name: string;
  priceInPaise: number;
  imageUrl?: string;
  soldOut?: boolean;
  quantityInCart?: number;
  onAdd: () => void;
  onIncrement?: () => void;
  onDecrement?: () => void;
}) {
  return (
    <View className="bg-surface rounded-md overflow-hidden border border-border mb-4">
      <View className="w-full h-36 bg-background items-center justify-center">
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} className="w-full h-36" resizeMode="cover" />
        ) : (
          <Text className="text-h1">🍽️</Text>
        )}
        {soldOut ? (
          <View className="absolute inset-0 bg-text-primary/70 items-center justify-center">
            <Text className="text-surface font-semibold text-caption">Sold Out</Text>
          </View>
        ) : null}
      </View>

      <View className="p-3 gap-1">
        <Text className="text-h2 text-text-primary" numberOfLines={1}>
          {name}
        </Text>
        <View className="flex-row items-center justify-between mt-1">
          <Text className="text-price text-text-primary">{formatRupees(priceInPaise)}</Text>

          {soldOut ? null : quantityInCart > 0 ? (
            <View className="flex-row items-center bg-primary rounded-pill">
              <Pressable
                onPress={onDecrement}
                accessibilityRole="button"
                accessibilityLabel={`Remove one ${name}`}
                className="px-3 py-2 active:opacity-80"
              >
                <Text className="text-surface text-button font-bold">−</Text>
              </Pressable>
              <Text className="text-surface text-button font-semibold px-1">{quantityInCart}</Text>
              <Pressable
                onPress={onIncrement}
                accessibilityRole="button"
                accessibilityLabel={`Add one more ${name}`}
                className="px-3 py-2 active:opacity-80"
              >
                <Text className="text-surface text-button font-bold">+</Text>
              </Pressable>
            </View>
          ) : (
            <PrimaryButton label="ADD" onPress={onAdd} size="sm" />
          )}
        </View>
      </View>
    </View>
  );
}
