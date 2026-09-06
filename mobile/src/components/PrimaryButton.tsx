import React from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { colors } from '../theme/tokens';

// Shared high-contrast CTA — specs/013-blue-theme-visual-design FR-008.
// Every primary action across all 3 surfaces (Add to Cart, Place Order, Pay
// Now, Confirm, Save, ...) renders through this one component so the "main
// action" on any screen is always visually consistent.
export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  size = 'md',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** 'sm' for compact contexts like a ProductCard's ADD control. */
  size?: 'sm' | 'md';
}) {
  // Loading and disabled are interaction-equivalent (both block onPress) but
  // deliberately NOT chrome-equivalent: loading keeps the enabled bg-primary
  // fill (this action is happening, not unavailable) with a white spinner,
  // while a plain disabled button gets the muted bg-border/text-secondary
  // treatment — otherwise a user (sighted or via accessibilityState) cannot
  // tell "in progress" from "cannot be used" from the button's chrome alone.
  const isInteractionDisabled = disabled || loading;
  const isMutedStyle = disabled && !loading;
  const paddingClass = size === 'sm' ? 'px-4 py-2' : 'px-6 py-3';
  const textSizeClass = size === 'sm' ? 'text-caption' : 'text-button';

  return (
    <Pressable
      onPress={onPress}
      disabled={isInteractionDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isInteractionDisabled, busy: loading }}
      className={`rounded-pill items-center justify-center active:opacity-80 ${paddingClass} ${
        isMutedStyle ? 'bg-border' : 'bg-primary'
      }`}
    >
      {loading ? (
        <ActivityIndicator color={colors.surface} size="small" />
      ) : (
        <Text
          className={`font-semibold text-center ${textSizeClass} ${
            isMutedStyle ? 'text-text-secondary' : 'text-surface'
          }`}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
