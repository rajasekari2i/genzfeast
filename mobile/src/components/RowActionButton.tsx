import React from 'react';
import { ActivityIndicator, GestureResponderEvent, Pressable, Text } from 'react-native';
import { accents, colors } from '../theme/tokens';

/**
 * A list card's Edit/Delete action, styled as the same rounded-pill chip the
 * rest of this app already uses for status (CompanyListScreen's Open/Closed,
 * UserListScreen's active/inactive) — not a bare emoji glyph, which renders
 * in its own full-color OS-drawn style regardless of the app's palette and
 * reads as visually foreign next to everything else on the card.
 * specs/017-ui-refresh: 'edit' now uses colors.link rather than the brand
 * colour — the brand never clears 4.5:1 as a foreground (research R8), and
 * link (#B23C0E) scores 5.63:1 on cream. 'delete' uses accents.red.strong
 * rather than Tailwind's built-in red-600, which is off-palette and
 * invisible to the token-discipline gate (contract O1).
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
      style={{ borderColor: isDelete ? accents.red.strong : colors.link }}
      className="rounded-pill px-sm min-h-touch justify-center border active:opacity-70"
    >
      {loading ? (
        <ActivityIndicator size="small" color={isDelete ? accents.red.strong : colors.link} />
      ) : (
        <Text style={{ color: isDelete ? accents.red.strong : colors.link }} className="text-label">
          {isDelete ? 'Delete' : 'Edit'}
        </Text>
      )}
    </Pressable>
  );
}
