import React from 'react';
import { Pressable, Text } from 'react-native';

// Compact, tappable category filter — specs/013-blue-theme-visual-design
// FR-007. Used on the Student Home screen's category filter row.
export function CategoryChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`rounded-pill px-md mr-sm min-h-touch items-center justify-center active:opacity-80 border ${
        selected ? 'bg-primary border-primary' : 'bg-surface border-border-soft'
      }`}
    >
      <Text className={`text-label ${selected ? 'text-espresso' : 'text-text-secondary'}`}>
        {label}
      </Text>
    </Pressable>
  );
}
