import React from 'react';
import { ScrollView, View } from 'react-native';

/**
 * Shared screen shell — every screen in the app renders through this, so
 * theming it once (specs/013-blue-theme-visual-design) applies the Design
 * Token Set everywhere: background, text, and typography all come from
 * tokens.ts via the NativeWind classes WU1 wired up, not the platform's
 * black/white defaults.
 *
 * `title` is never rendered visibly here — every screen already gets its
 * title from its Stack.Screen `options={{ title: ... }}` in the navigator,
 * so an in-body heading duplicated it. Kept only as the scroll view's
 * accessibility label. `subtitle`/`specRef` were the original spec-tracing
 * captions shown during initial implementation and are no longer displayed;
 * still accepted so existing call sites don't need to change.
 */
export function Screen({
  title,
  subtitle: _subtitle,
  specRef: _specRef,
  children,
  scroll = true,
}: {
  title: string;
  subtitle?: string;
  specRef?: string;
  children?: React.ReactNode;
  /**
   * false for a screen that renders its own scrollable FlatList (a
   * server-side-paginated list fetching the next page via onEndReached) —
   * nesting a scrolling FlatList inside this component's own ScrollView
   * breaks both scroll position tracking and onEndReached entirely. The
   * screen is then responsible for giving its own content `flex-1` so the
   * FlatList fills the remaining height.
   */
  scroll?: boolean;
}) {
  if (!scroll) {
    return (
      <View className="flex-1 bg-background p-6" accessibilityLabel={title}>
        {children}
      </View>
    );
  }
  return (
    <ScrollView className="flex-1 bg-background" accessibilityLabel={title}>
      <View className="p-6">{children}</View>
    </ScrollView>
  );
}
