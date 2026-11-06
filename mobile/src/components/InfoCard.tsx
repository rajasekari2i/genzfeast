import React from 'react';
import { Text, View } from 'react-native';
import { colors, radius, type AccentName } from '../theme/tokens';
import { IconTile } from './AdminList';

/**
 * The white read-only detail list the `Profile` and `ContactUs` artboards
 * both use: a bordered card whose rows are divided by hairlines.
 *
 * Read-only by construction — editing happens on a separate screen, which
 * is why these are plain label/value rows rather than disabled inputs.
 */
export function InfoCard({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{ borderRadius: radius['5xl'], borderWidth: 1, borderColor: colors.border }}
      className="bg-surface overflow-hidden"
    >
      {children}
    </View>
  );
}

export function InfoRow({
  label,
  value,
  icon,
  last = false,
  note,
}: {
  label: string;
  value: string;
  /**
   * Optional leading tile. The caller names a glyph and an accent FAMILY,
   * never colours — contract O3 keeps family selection out of screens.
   */
  icon?: { glyph: string; accent?: AccentName };
  last?: boolean;
  /** Trailing note on the label, e.g. the lock on a read-only username. */
  note?: string;
}) {
  return (
    <View
      style={{ borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border }}
      className="flex-row items-center gap-sm px-md py-sm min-h-touch"
    >
      {icon ? <IconTile glyph={icon.glyph} accent={icon.accent} /> : null}
      <View className="flex-1 gap-xs">
        <Text className="text-caption text-text-secondary">
          {label}
          {note ? ` ${note}` : ''}
        </Text>
        <Text className="text-bodyBold text-text-primary">{value}</Text>
      </View>
    </View>
  );
}
