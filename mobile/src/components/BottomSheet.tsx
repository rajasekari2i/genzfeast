import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, size } from '../theme/tokens';
import { Icon } from './Icon';
import { IconTile } from './AdminList';
import type { IconName } from './Icon';
import type { AccentName } from '../theme/tokens';

/**
 * The bottom sheet the admin "Edit category" and "Add department" artboards
 * use. They are NOT full screens — the list stays visible behind a scrim:
 *
 *   padding 12px 20px 28px   border-radius: 30px 30px 0 0   gap 20
 *   grab handle 44x5 at radius 999 in sheetHandle, centred
 *   title row: 44px accent tile (radius 14) · h2 Bricolage 800 24/-0.5
 *              · 44px circular close on tileNeutral
 *
 * The route keeps its name and params; only its `presentation` changes to
 * transparentModal so the sheet floats over the list (FR-028).
 */
export function BottomSheet({
  title,
  icon,
  accent = 'neutral',
  onClose,
  children,
}: {
  title: string;
  icon: IconName;
  accent?: AccentName;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 justify-end">
      {/* Scrim — tapping it dismisses, which is what a sheet's backdrop does
          everywhere else on Android. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        onPress={onClose}
        style={{ position: 'absolute', inset: 0, backgroundColor: colors.scrim }}
      />
      <View
        style={{
          backgroundColor: colors.surface,
          borderTopLeftRadius: radius.sheet,
          borderTopRightRadius: radius.sheet,
          paddingTop: 12,
          paddingHorizontal: 20,
          paddingBottom: 28 + insets.bottom,
          gap: 20,
        }}
      >
        <View
          style={{ width: 44, height: 5, borderRadius: radius.pill, backgroundColor: colors.sheetHandle }}
          className="self-center"
        />

        <View className="flex-row items-center gap-sm">
          <IconTile icon={icon} accent={accent} size="md" />
          <Text className="flex-1 text-title-sm text-text-primary">{title}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            style={{
              width: size.touch,
              height: size.touch,
              borderRadius: size.touch / 2,
              backgroundColor: colors.tileNeutral,
            }}
            className="items-center justify-center active:opacity-70"
          >
            <Icon name="close" size={18} color={colors.espresso} />
          </Pressable>
        </View>

        {children}
      </View>
    </View>
  );
}
