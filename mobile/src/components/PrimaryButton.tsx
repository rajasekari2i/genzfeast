import React from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { colors } from '../theme/tokens';

/**
 * Shared CTA — specs/017-ui-refresh FR-012, FR-013, FR-015.
 *
 * Two enabled variants:
 *   'primary' — espresso fill, light label. The default action.
 *   'brand'   — brand fill, espresso label. Reserved for the moments the
 *               design makes brand-coloured (Pay Again, ADD).
 *
 * The disabled treatment differs by BORDER STYLE as well as colour — a
 * dashed outline on a muted fill (FR-013). Colour alone is not an accessible
 * distinction, and the previous solid-grey treatment relied on it.
 *
 * Loading and disabled both block onPress but are deliberately NOT
 * chrome-equivalent: loading keeps the enabled fill (this action is
 * happening) while disabled gets the dashed muted treatment (this action is
 * unavailable). Otherwise neither a sighted user nor accessibilityState can
 * tell them apart.
 */
export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  size = 'md',
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** 'sm' still meets the 44-unit touch floor (FR-015). */
  size?: 'sm' | 'md';
  variant?: 'primary' | 'brand';
}) {
  const isInteractionDisabled = disabled || loading;
  const isMuted = disabled && !loading;

  const height = size === 'sm' ? 'h-touch' : 'h-control';
  const padding = size === 'sm' ? 'px-md' : 'px-lg';

  const fill = isMuted
    ? 'bg-disabled-fill border border-dashed border-border-dashed'
    : variant === 'brand'
      ? 'bg-primary'
      : 'bg-espresso';

  const labelColor = isMuted
    ? 'text-disabled-text'
    : variant === 'brand'
      ? 'text-espresso'
      : 'text-surface';

  return (
    <Pressable
      onPress={onPress}
      disabled={isInteractionDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isInteractionDisabled, busy: loading }}
      className={`${height} ${padding} ${fill} rounded-pill items-center justify-center active:opacity-80`}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'brand' ? colors.espresso : colors.surface} size="small" />
      ) : (
        <Text className={`text-button text-center ${labelColor}`}>{label}</Text>
      )}
    </Pressable>
  );
}
