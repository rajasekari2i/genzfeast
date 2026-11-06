import React from 'react';
import { Switch, Text, View } from 'react-native';
import { colors } from '../theme/tokens';

/**
 * Labelled switch row — specs/017-ui-refresh FR-019.
 *
 * The sold-out control. State is conveyed by the switch POSITION and by the
 * state text, never by colour alone, so it stays readable for a colour-blind
 * operator under canteen lighting.
 *
 * The whole row is the target, comfortably past the 44-unit floor (FR-015) —
 * staff use this repeatedly and at speed.
 */
export function SwitchRow({
  label,
  value,
  onValueChange,
  onLabel = 'On',
  offLabel = 'Off',
  disabled = false,
  compact = false,
}: {
  label: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  onLabel?: string;
  offLabel?: string;
  disabled?: boolean;
  /** Stacked switch-over-label, for inline use inside a list card. */
  compact?: boolean;
}) {
  if (compact) {
    return (
      <View className="items-center gap-xs min-h-touch justify-center">
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          accessibilityRole="switch"
          accessibilityState={{ checked: value, disabled }}
          accessibilityLabel={label}
          trackColor={{ false: colors.borderDashed, true: colors.secondary }}
          thumbColor={colors.surface}
        />
        <Text className="text-caption text-text-secondary">{value ? onLabel : offLabel}</Text>
      </View>
    );
  }

  return (
    <View className="flex-row items-center justify-between min-h-touch py-sm">
      <View className="flex-1 pr-md">
        <Text className="text-body text-text-primary">{label}</Text>
        <Text className="text-caption text-text-secondary">{value ? onLabel : offLabel}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityRole="switch"
        accessibilityState={{ checked: value, disabled }}
        accessibilityLabel={label}
        trackColor={{ false: colors.borderDashed, true: colors.secondary }}
        thumbColor={colors.surface}
      />
    </View>
  );
}
