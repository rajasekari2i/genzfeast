import React from 'react';
import { View } from 'react-native';
import { colors } from '../theme/tokens';

/**
 * Veg / non-veg indicator — specs/017-ui-refresh FR-005.
 *
 * The two marks differ in SHAPE as well as colour (a dot vs a triangle
 * inside a bordered square), so they remain distinguishable without colour
 * vision. The Indian convention this follows is itself shape-bearing.
 */
export function DietaryMark({ isVeg }: { isVeg: boolean }) {
  const tint = isVeg ? colors.secondary : colors.nonVeg;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={isVeg ? 'Vegetarian' : 'Non-vegetarian'}
      style={{ borderColor: tint, borderWidth: 1.5, width: 14, height: 14 }}
      className="rounded-glyph items-center justify-center"
    >
      {isVeg ? (
        <View style={{ backgroundColor: tint, width: 6, height: 6 }} className="rounded-pill" />
      ) : (
        <View
          style={{
            width: 0,
            height: 0,
            borderLeftWidth: 3.5,
            borderRightWidth: 3.5,
            borderBottomWidth: 6,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderBottomColor: tint,
          }}
        />
      )}
    </View>
  );
}
