import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { DietaryMark } from './DietaryMark';
import { formatRupees } from '../theme/money';
import { productTint } from '../theme/accents';

/**
 * Menu card — specs/017-ui-refresh FR-021, FR-026.
 *
 * Sized for the two-column grid the redesign introduces. A sold-out dish
 * carries an explicit rotated STAMP and a removed add control, not a faint
 * dim — the previous 70%-opacity overlay was easy to miss and left the
 * control looking tappable.
 *
 * With no photo, the image block shows a tinted placeholder drawn from the
 * shared accent families, keyed deterministically off the product id so a
 * dish keeps the same colour between renders (research R4).
 */
export function ProductCard({
  productId,
  name,
  description,
  priceInPaise,
  imageUrl,
  isVeg,
  soldOut = false,
  quantityInCart = 0,
  onAdd,
  onIncrement,
  onDecrement,
}: {
  productId: string;
  name: string;
  description?: string;
  priceInPaise: number;
  imageUrl?: string;
  isVeg?: boolean;
  soldOut?: boolean;
  quantityInCart?: number;
  onAdd: () => void;
  onIncrement?: () => void;
  onDecrement?: () => void;
}) {
  return (
    <View className="flex-1 bg-surface rounded-5xl border border-border p-xs pb-sm">
      <View
        style={{ backgroundColor: productTint(productId), height: 104 }}
        className="rounded-2xl overflow-hidden items-center justify-center"
      >
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} className="w-full h-full" resizeMode="cover" />
        ) : (
          <Text className="text-title">🍽️</Text>
        )}
        {soldOut ? (
          <View
            style={{ transform: [{ rotate: '-8deg' }], borderWidth: 2 }}
            className="absolute bg-surface border-espresso rounded-xs px-sm py-xs"
          >
            <Text className="text-eyebrow text-espresso">SOLD OUT</Text>
          </View>
        ) : null}
      </View>

      <View className="px-xs pt-sm gap-xs">
        <View className="flex-row items-center gap-xs">
          {isVeg === undefined ? null : <DietaryMark isVeg={isVeg} />}
          <Text className="flex-1 text-body-bold text-text-primary" numberOfLines={1}>
            {name}
          </Text>
        </View>
        {description ? (
          <Text className="text-caption text-text-secondary" numberOfLines={2}>
            {description}
          </Text>
        ) : null}

        <View className="flex-row items-center justify-between pt-xs">
          <Text className="text-price text-text-primary">{formatRupees(priceInPaise)}</Text>

          {soldOut ? null : quantityInCart > 0 ? (
            <View className="flex-row items-center bg-espresso rounded-pill">
              <Pressable
                onPress={onDecrement}
                accessibilityRole="button"
                accessibilityLabel={`Remove one ${name}`}
                className="w-touch h-touch items-center justify-center active:opacity-80"
              >
                <Text className="text-body-bold text-surface">−</Text>
              </Pressable>
              <Text className="text-body-bold text-surface">{quantityInCart}</Text>
              <Pressable
                onPress={onIncrement}
                accessibilityRole="button"
                accessibilityLabel={`Add one more ${name}`}
                className="w-touch h-touch items-center justify-center active:opacity-80"
              >
                <Text className="text-body-bold text-surface">+</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={onAdd}
              accessibilityRole="button"
              accessibilityLabel={`Add ${name}`}
              className="h-touch px-md bg-primary rounded-pill flex-row items-center justify-center active:opacity-80"
            >
              <Text className="text-eyebrow text-espresso">ADD +</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}
