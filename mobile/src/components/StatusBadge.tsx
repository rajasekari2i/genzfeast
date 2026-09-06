import React from 'react';
import { Text, View } from 'react-native';
import { statusColors, OrderStatus } from '../theme/statusColors';

// Order-status indicator — specs/013-blue-theme-visual-design FR-002/FR-003.
// Reused identically across Student My Orders/Order Detail, Staff Incoming
// Orders, and any admin order view.
//
// Deliberately a colored DOT + a dark, always-legible text label, rather
// than a solid-colored pill with white text — this sidesteps needing a
// separate per-status contrast check for arbitrary status colors (e.g.
// status-pending's amber would not reliably pass AA with a white label),
// while still conveying status via color AND text, never color alone.
export function StatusBadge({ status }: { status: OrderStatus }) {
  const { color, label } = statusColors[status];

  return (
    <View className="flex-row items-center bg-surface border border-border rounded-pill px-3 py-1 self-start">
      <View style={{ backgroundColor: color }} className="w-2 h-2 rounded-full mr-2" />
      <Text className="text-caption font-semibold text-text-primary">{label}</Text>
    </View>
  );
}
