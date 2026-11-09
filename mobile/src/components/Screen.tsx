import React from 'react';
import { ScrollView, View } from 'react-native';

/**
 * Shared screen shell — every screen renders through this, so theming it once
 * applies the Design Token Set everywhere.
 *
 * `surface` is new in specs/017-ui-refresh: the app has TWO grounds, not one
 * (research R1). Student-facing screens sit on cream; Company Admin and Staff
 * screens sit on a cooler warm grey with navy chrome. A screen DECLARES which
 * it is rather than hardcoding a ground class (contract O2).
 *
 * `title` is never rendered visibly — every screen gets its title from its
 * Stack.Screen options. Kept as the accessibility label.
 */
export function Screen({
  title,
  subtitle: _subtitle,
  specRef: _specRef,
  children,
  scroll = true,
  surface = 'student',
  header,
}: {
  title: string;
  subtitle?: string;
  specRef?: string;
  children?: React.ReactNode;
  /**
   * false for a screen that renders its own scrollable list — nesting a
   * scrolling list inside this ScrollView breaks scroll tracking and
   * onEndReached. The screen must then give its content `flex-1`.
   */
  scroll?: boolean;
  /** Which ground this screen sits on (research R1). */
  surface?: 'student' | 'admin';
  /**
   * Full-bleed chrome rendered ABOVE the padded content — the navy
   * AdminHeader needs to reach the screen edges and own its own padding,
   * so it cannot sit inside `p-md`. Scrolls with the content when
   * `scroll` is true, matching the artboards (the header is part of the
   * page, not a pinned bar).
   */
  header?: React.ReactNode;
}) {
  const ground = surface === 'admin' ? 'bg-background-alt' : 'bg-background';

  if (!scroll) {
    return (
      <View className={`flex-1 ${ground}`} accessibilityLabel={title}>
        {header}
        <View className="flex-1 p-md">{children}</View>
      </View>
    );
  }
  return (
    <ScrollView className={`flex-1 ${ground}`} accessibilityLabel={title}>
      {header}
      <View className="p-md">{children}</View>
    </ScrollView>
  );
}
