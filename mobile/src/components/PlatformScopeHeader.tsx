import React from 'react';
import { Text, View } from 'react-native';

// System Admin Portal's distinct "platform-wide" header treatment —
// specs/013-blue-theme-visual-design FR-010; restyled by specs/017.
// NOTE: currently unreferenced (no System Admin surface exists in this
// app). Restyled rather than deleted — removing a file is outside a
// visual refresh, and leaving it unstyled would fail the G7/O1 gates. Shares the platform's base
// palette/typography but carries an unmistakable visual marker (the
// "PLATFORM ADMIN" label + a darker primary-variant fill, vs. the Tenant
// Admin & Staff App's plain primary-colored header) so a System Admin never
// confuses a platform-wide screen for a single-company one.
export function PlatformScopeHeader({ title }: { title: string }) {
  return (
    <View className="bg-primary-variant px-md pt-xl pb-md">
      <View className="self-start bg-surface/20 rounded-pill px-sm mb-sm">
        <Text className="text-surface text-eyebrow">PLATFORM ADMIN</Text>
      </View>
      <Text className="text-surface text-title">{title}</Text>
    </View>
  );
}
