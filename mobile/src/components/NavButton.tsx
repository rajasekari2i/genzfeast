import React from 'react';
import { View } from 'react-native';
import { PrimaryButton } from './PrimaryButton';

/**
 * Thin, full-width wrapper around PrimaryButton for stacked nav-style button
 * lists (the dev Surface Picker, screen-to-screen quick links). Keeps even
 * these ad hoc navigation buttons on the platform's one CTA style (FR-008)
 * rather than a separate dark button.
 */
export function NavButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <View className="mb-2">
      <PrimaryButton label={label} onPress={onPress} />
    </View>
  );
}
