import React from 'react';
import { Text, View } from 'react-native';

// Themed empty-state — specs/013-blue-theme-visual-design FR-009, extending
// docs/ui-screen/06-UI-Design.md §8's Accessibility & States checklist.
// Used for an empty cart, no products (canteen closed/all sold out), or no
// orders — anywhere a list can legitimately be empty.
export function EmptyState({
  icon = '🍽️',
  title,
  subtitle,
}: {
  /** A single emoji — no icon library dependency (research.md keeps this feature dependency-free). */
  icon?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View className="items-center justify-center py-16 px-6">
      <Text className="text-h1 mb-3">{icon}</Text>
      <Text className="text-h2 text-text-primary text-center">{title}</Text>
      {subtitle ? (
        <Text className="text-body text-text-secondary text-center mt-1">{subtitle}</Text>
      ) : null}
    </View>
  );
}
