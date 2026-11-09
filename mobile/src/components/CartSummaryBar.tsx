import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatRupees } from '../theme/money';
import { Icon } from './Icon';
import { colors, radius } from '../theme/tokens';

// Persistent floating cart summary — specs/013-blue-theme-visual-design
// FR-006. Renders nothing when the cart is empty, so callers can always
// mount it unconditionally on a browsing screen without their own
// itemCount check (single source of truth for the "whenever non-empty"
// rule).
export function CartSummaryBar({
  itemCount,
  totalInPaise,
  onViewCart,
}: {
  itemCount: number;
  totalInPaise: number;
  onViewCart: () => void;
}) {
  if (itemCount <= 0) {
    return null;
  }

  return (
    <View className="absolute left-md right-md bottom-lg">
      {/* Section 05: a 68px espresso bar with a two-line label on the left
          and a brand "Continue" button inset on the right, rather than one
          flat pill. The whole bar is still tappable as a fallback, but the
          button is the primary affordance. */}
      <View
        style={{
          height: 68,
          backgroundColor: colors.espresso,
          borderRadius: radius.pill,
          shadowColor: colors.shadow,
          shadowOpacity: 0.2,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }}
        className="flex-row items-center pl-lg pr-xs"
      >
        <Pressable
          onPress={onViewCart}
          accessibilityRole="button"
          accessibilityLabel="View cart"
          className="flex-1 active:opacity-80"
        >
          <Text className="text-body-bold text-surface">
            {itemCount} {itemCount === 1 ? 'item' : 'items'} added
          </Text>
          <Text className="text-caption text-text-on-dark">
            {formatRupees(totalInPaise)} · Canteen pickup
          </Text>
        </Pressable>
        <Pressable
          onPress={onViewCart}
          accessibilityRole="button"
          accessibilityLabel="Continue to cart"
          style={{ height: 52, backgroundColor: colors.primary, borderRadius: radius.pill }}
          className="px-lg flex-row items-center gap-xs active:opacity-80"
        >
          <Text className="text-label-bold text-espresso">Continue</Text>
          <Icon name="arrowRight" size={16} color={colors.espresso} />
        </Pressable>
      </View>
    </View>
  );
}
