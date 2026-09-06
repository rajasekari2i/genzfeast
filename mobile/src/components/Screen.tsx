import React from 'react';
import { ScrollView, Text, View } from 'react-native';

/**
 * Shared screen shell — every screen in the app renders through this, so
 * theming it once (specs/013-blue-theme-visual-design) applies the Design
 * Token Set everywhere: background, text, and typography all come from
 * tokens.ts via the NativeWind classes WU1 wired up, not the platform's
 * black/white defaults.
 */
export function Screen({
  title,
  subtitle,
  specRef,
  children,
}: {
  title: string;
  subtitle?: string;
  /** e.g. "UI Design §4.5" — where this screen's real spec lives */
  specRef?: string;
  children?: React.ReactNode;
}) {
  return (
    <ScrollView className="flex-1 bg-background">
      <View className="p-6 gap-2">
        <Text className="text-h1 text-text-primary">{title}</Text>
        {subtitle ? <Text className="text-body text-text-secondary">{subtitle}</Text> : null}
        {specRef ? <Text className="text-caption text-text-secondary">{specRef}</Text> : null}
        <View className="mt-4">{children}</View>
      </View>
    </ScrollView>
  );
}
