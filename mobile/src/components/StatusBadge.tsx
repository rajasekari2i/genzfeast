import React from 'react';
import { Text, View } from 'react-native';
import { resolveStatus } from '../theme/statusColors';

/**
 * Order-status indicator — specs/017-ui-refresh FR-004.
 *
 * A soft-tinted pill carrying a 7px dot AND its text label. Status is never
 * conveyed by colour alone. Each status draws its {soft, strong, dot} from
 * the shared accent families, so a badge can never drift from an icon tile
 * or product tint of the same family (research R4).
 *
 * Accepts any string: a status outside the four designed values renders in
 * the neutral family with its raw value as the label rather than a blank
 * badge (contract G6). The order lifecycle defines `cancelled`, which no
 * code path currently sets.
 */
export function StatusBadge({ status }: { status: string }) {
  const { soft, strong, dot, label } = resolveStatus(status);

  return (
    <View
      style={{ backgroundColor: soft }}
      className="flex-row items-center rounded-pill px-sm py-xs self-start"
    >
      <View style={{ backgroundColor: dot }} className="w-sm h-sm rounded-pill mr-xs" />
      <Text style={{ color: strong }} className="text-eyebrow">
        {label}
      </Text>
    </View>
  );
}
