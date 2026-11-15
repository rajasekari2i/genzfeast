import React from 'react';
import { ActivityIndicator, GestureResponderEvent, Pressable, Text } from 'react-native';
import { accents, colors, radius, size } from '../theme/tokens';
import { Icon } from './Icon';

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

  // The artboards give a list row a compact 44x44 SQUARE control carrying a
  // glyph, not a text pill — "Company Admin · Products" draws the edit
  // control at radius 14 on tileNeutral with a navy pencil. Two stacked text
  // pills ate roughly a third of the row's width and pushed the product
  // name into an ellipsis.
  const tone = isDelete ? colors.danger : colors.primaryVariant;

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={8}
      disabled={disabled || loading}
      onPress={onPress}
      style={{
        width: size.touch,
        height: size.touch,
        borderRadius: radius.lg,
        backgroundColor: isDelete ? accents.red.soft : colors.tileNeutral,
      }}
      className="items-center justify-center active:opacity-70"
    >
      {loading ? (
        <ActivityIndicator size="small" color={tone} />
      ) : (
        <Icon name={isDelete ? 'trash' : 'edit'} size={18} color={tone} />
      )}
    </Pressable>
  );
}
