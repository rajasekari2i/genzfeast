import React from 'react';
import { View } from 'react-native';
import { colors, radius } from '../theme/tokens';

/**
 * Brand-filled hero panel — the treatment the `Profile`, `ContactUs` and
 * `Login` artboards share: the tenant colour with an oversized sun-coloured
 * disc bleeding off one corner.
 *
 * The disc is decorative and sits behind the content, so everything passed
 * as children renders above it.
 */
export function HeroCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <View
      style={{ backgroundColor: colors.primary, borderRadius: radius['6xl'] }}
      className={`p-md overflow-hidden ${className}`}
    >
      <View
        style={{
          position: 'absolute',
          width: 150,
          height: 150,
          borderRadius: radius.pill,
          backgroundColor: colors.accent,
          top: -36,
          right: -36,
        }}
      />
      {children}
    </View>
  );
}
