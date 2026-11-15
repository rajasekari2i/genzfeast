import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { colors, radius, size } from '../theme/tokens';
import { Icon } from './Icon';
import { tile } from '../theme/accents';

/**
 * The paid order's pickup code — the hero of section 08 ("Order placed +
 * pickup OTP"). An espresso card with a header row (label + Copy), six SUN
 * cells at display size, and a footer note.
 *
 * Read-only by design. The code is stored in plaintext precisely so the diner
 * can re-read it until pickup, and it is NEVER rendered on a staff screen —
 * staff can only submit a candidate for comparison (FR-018).
 */
export function OtpDisplay({
  code,
  title = 'Show this OTP at the counter',
  footer,
}: {
  code: string;
  title?: string;
  footer?: string;
}) {
  const digits = code.split('');
  const sun = tile('sun');

  return (
    <View style={{ backgroundColor: colors.espresso, borderRadius: radius['6xl'] }} className="p-md gap-sm">
      <View className="flex-row items-center justify-between">
        <Text className="text-label text-text-on-dark">{title}</Text>
        <Pressable
          onPress={() => Clipboard.setString(code)}
          accessibilityRole="button"
          accessibilityLabel="Copy code"
          style={{ height: size.touch, backgroundColor: colors.espressoRaised, borderRadius: radius.pill }}
          className="px-md flex-row items-center gap-xs active:opacity-80"
        >
          <Icon name="copy" size={15} color={colors.surface} />
          <Text className="text-label text-surface">Copy</Text>
        </Pressable>
      </View>

      <View className="flex-row gap-glyph" accessibilityLabel={`Pickup code ${digits.join(' ')}`}>
        {digits.map((d, i) => (
          <View
            key={`${d}-${i}`}
            style={{ height: 64, borderRadius: radius.lg, backgroundColor: sun.backgroundColor }}
            className="flex-1 items-center justify-center"
          >
            <Text className="text-hero-lg text-espresso">{d}</Text>
          </View>
        ))}
      </View>

      {footer ? <Text className="text-caption text-text-on-dark">{footer}</Text> : null}
    </View>
  );
}
