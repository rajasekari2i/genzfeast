import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors, radius, size } from '../theme/tokens';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { tile } from '../theme/accents';
import type { AccentName } from '../theme/tokens';

/**
 * The header row every student auth screen below Login shares — Register,
 * Forgot password, Enter code — measured off
 * docs/ui-screen/GenzFeast-Student-Journey.html:
 *
 *   44px circular back control, white with a 1px borderSoft rule
 *   then the CANTEEN NAME at 13px in textSecondary — not a screen title
 *
 * That is deliberate in the artboards: someone resetting a password needs to
 * know which canteen they are resetting it for (usernames are unique per
 * tenant, so the same number can exist at two), and the heading right below
 * already says what the screen is.
 */
export function AuthHeader({ onBack, canteen }: { onBack: () => void; canteen?: string }) {
  return (
    <View className="flex-row items-center gap-sm">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack}
        style={{
          width: size.touch,
          height: size.touch,
          borderRadius: size.touch / 2,
          borderWidth: 1,
          borderColor: colors.borderSoft,
        }}
        className="bg-surface items-center justify-center active:opacity-70"
      >
        <Icon name="chevronLeft" size={20} color={colors.espresso} />
      </Pressable>
      {canteen ? <Text className="text-label text-text-secondary">{canteen}</Text> : null}
    </View>
  );
}

/**
 * A word inside a headline sitting on a brand-coloured plate — "Join the
 * [feast]", "Check your [messages]", "what's the [craving?]".
 *
 * MUST be a View, not a nested <Text> with a background: React Native ignores
 * borderRadius on an inline text background entirely, so the earlier Text
 * version rendered a SHARP rectangle however the radius was set. The trade is
 * that a View does not sit inside a <Text> flow, so the call site lays the
 * lead text and this plate out in a `flex-row flex-wrap items-center` row
 * rather than one Text string. `textClassName` must match the headline's own
 * type class so the word is the same size as the words around it.
 */
export function Highlight({
  children,
  textClassName,
}: {
  children: React.ReactNode;
  textClassName: string;
}) {
  return (
    <View style={{ backgroundColor: colors.primary, borderRadius: radius.md }} className="px-xs">
      <Text className={textClassName}>{children}</Text>
    </View>
  );
}

/**
 * The soft advisory strip these screens put under a form — amber on Forgot
 * password ("the code arrives by SMS or notification"), mint on Enter code
 * ("resetting unlocks a locked account").
 *
 * Takes an accent FAMILY, never colours: gate O3 keeps family selection out
 * of screens, and `tile()` resolves the soft/strong pair.
 */
export function InfoStrip({
  icon,
  accent,
  children,
}: {
  icon: IconName;
  accent: AccentName;
  children: React.ReactNode;
}) {
  const pair = tile(accent);
  return (
    <View
      style={{ backgroundColor: pair.backgroundColor, borderRadius: radius.xl }}
      className="flex-row items-start gap-sm px-md py-sm"
    >
      <Icon name={icon} size={18} color={pair.color} />
      <Text style={{ color: pair.color }} className="flex-1 text-label">
        {children}
      </Text>
    </View>
  );
}
