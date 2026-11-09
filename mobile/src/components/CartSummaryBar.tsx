import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatRupees } from '../theme/money';
import { colors } from '../theme/tokens';

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
      <Pressable
        onPress={onViewCart}
        accessibilityRole="button"
        className="flex-row items-center justify-between bg-espresso rounded-pill px-lg min-h-control active:opacity-90"
        style={{
          shadowColor: colors.shadow,
          shadowOpacity: 0.2,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }}
      >
        <Text className="text-surface text-body">
          {itemCount} {itemCount === 1 ? 'item' : 'items'} · {formatRupees(totalInPaise)}
        </Text>
        <Text className="text-surface text-button">View Cart →</Text>
      </Pressable>
    </View>
  );
}
