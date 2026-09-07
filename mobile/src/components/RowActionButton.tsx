import React from 'react';
import { ActivityIndicator, GestureResponderEvent, Pressable, Text } from 'react-native';
import { colors } from '../theme/tokens';

/**
 * A list card's Edit/Delete action, styled as the same rounded-pill chip the
 * rest of this app already uses for status (CompanyListScreen's Open/Closed,
 * UserListScreen's active/inactive) — not a bare emoji glyph, which renders
 * in its own full-color OS-drawn style regardless of the app's palette and
 * reads as visually foreign next to everything else on the card.
 * 'edit' uses the brand primary color; 'delete' reuses the exact Error Red
 * (#DC2626) statusColors.ts already uses for payment_failed — Tailwind's
 * built-in `red-600` is that same hex, so no new color is introduced.
 */
export function RowActionButton({
  variant,
  label,
  onPress,
  loading = false,
  disabled = false,
}: {
  variant: 'edit' | 'delete';
  /** Accessibility label only, e.g. "Edit Sapthagiri catering" — the chip's own visible text is fixed ("Edit"/"Delete"). */
  label: string;
  onPress: (e: GestureResponderEvent) => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const isDelete = variant === 'delete';

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={8}
      disabled={disabled || loading}
      onPress={onPress}
      className={`rounded-pill px-2 py-0.5 border active:opacity-70 ${
        isDelete ? 'border-red-600' : 'border-primary'
      }`}
    >
      {loading ? (
        <ActivityIndicator size="small" color={isDelete ? '#DC2626' : colors.primary} />
      ) : (
        <Text className={`text-caption font-semibold ${isDelete ? 'text-red-600' : 'text-primary'}`}>
          {isDelete ? 'Delete' : 'Edit'}
        </Text>
      )}
    </Pressable>
  );
}
