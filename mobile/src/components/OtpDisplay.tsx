import React from 'react';
import { Text, View } from 'react-native';

/**
 * The pickup code, shown to the diner — specs/017-ui-refresh FR-017.
 *
 * Six individual brand-filled cells on an espresso panel, at display size so
 * the code is legible at arm's length across a counter. This is the hero of
 * a paid order.
 *
 * Read-only by design. The code is stored in plaintext precisely so the
 * diner can re-read it until pickup, and it is NEVER rendered on a staff
 * screen — staff can only submit a candidate for comparison (FR-018).
 */
export function OtpDisplay({ code, caption }: { code: string; caption?: string }) {
  const digits = code.split('');

  return (
    <View className="bg-espresso rounded-4xl p-md gap-sm">
      {caption ? <Text className="text-caption text-text-on-dark">{caption}</Text> : null}
      <View className="flex-row gap-xs" accessibilityLabel={`Pickup code ${digits.join(' ')}`}>
        {digits.map((d, i) => (
          <View
            key={`${d}-${i}`}
            className="flex-1 h-touch bg-primary rounded-sm items-center justify-center"
          >
            <Text className="text-hero text-espresso">{d}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
