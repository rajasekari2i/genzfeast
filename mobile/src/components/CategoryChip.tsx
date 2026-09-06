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
      className={`rounded-pill px-4 py-2 mr-2 active:opacity-80 border ${
        selected ? 'bg-primary border-primary' : 'bg-surface border-border'
      }`}
    >
      <Text className={`text-caption font-semibold ${selected ? 'text-surface' : 'text-text-secondary'}`}>
        {label}
      </Text>
    </Pressable>
  );
}
