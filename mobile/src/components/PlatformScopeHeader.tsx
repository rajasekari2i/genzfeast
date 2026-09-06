import React from 'react';
import { Text, View } from 'react-native';

// System Admin Portal's distinct "platform-wide" header treatment —
// specs/013-blue-theme-visual-design FR-010. Shares the platform's base
// palette/typography but carries an unmistakable visual marker (the
// "PLATFORM ADMIN" label + a darker primary-variant fill, vs. the Tenant
// Admin & Staff App's plain primary-colored header) so a System Admin never
// confuses a platform-wide screen for a single-company one.
export function PlatformScopeHeader({ title }: { title: string }) {
  return (
    <View className="bg-primary-variant px-6 pt-14 pb-4">
      <View className="self-start bg-surface/20 rounded-pill px-2 py-0.5 mb-2">
        <Text className="text-surface text-caption font-bold tracking-wide">PLATFORM ADMIN</Text>
      </View>
      <Text className="text-surface text-h1">{title}</Text>
    </View>
  );
}
