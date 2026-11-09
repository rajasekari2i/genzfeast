import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, size } from '../theme/tokens';
import { Icon } from './Icon';

/**
 * The navy header for an admin/staff screen BELOW the dashboard, measured off
 * "Company Admin · Products" in docs/ui-screen/GenzFeast-Admin-and-Staff.html:
 *
 *   background: #183153   border-radius: 0 0 28px 28px
 *   padding: 14px 20px 20px        column, gap 16
 *     row 1 (gap 12): 44px circular BACK control on #23426B
 *                     · title Bricolage 800 26px/-0.8, flex 1
 *                     · optional trailing count, Inter 13px #BCCBE0
 *     row 2: `children` — the search field on Products
 *
 * Deliberately a separate component from AdminHeader, not a variant of it:
 * the dashboard header carries an identity (logo, wordmark, role tag,
 * avatar) and 32px corners, this one carries navigation (back, title, count)
 * and 28px corners. Folding both into one component would mean a prop that
 * swaps out nearly every child.
 */
export function AdminPageHeader({
  title,
  count,
  onBack,
  children,
}: {
  title: string;
  /** Rendered verbatim, e.g. "24 items". Omitted when absent. */
  count?: string;
  onBack: () => void;
  /** Row two — the search field, or nothing. */
  children?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        backgroundColor: colors.primaryVariant,
        borderBottomLeftRadius: radius['6xl'],
        borderBottomRightRadius: radius['6xl'],
        paddingTop: insets.top + 14,
        paddingHorizontal: 20,
        paddingBottom: 20,
        gap: 16,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          style={{
            width: size.touch,
            height: size.touch,
            borderRadius: size.touch / 2,
            backgroundColor: colors.navyTint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="chevronLeft" size={20} color={colors.surface} />
        </Pressable>

        <Text className="flex-1 text-wordmark text-surface" numberOfLines={1}>
          {title}
        </Text>

        {count ? (
          <Text style={{ color: colors.navyMuted }} className="text-label">
            {count}
          </Text>
        ) : null}
      </View>

      {children}
    </View>
  );
}

/**
 * The search field that sits in row two — white on the navy ground, with the
 * glyph inset at 16px and the input padded clear of it (the artboard uses
 * `padding: 0 16px 0 44px`, not an icon in a flex row).
 */
export function AdminSearchBar({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ position: 'relative', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', left: 16, zIndex: 1 }}>
        <Icon name="search" size={18} color={colors.textSecondary} />
      </View>
      {children}
    </View>
  );
}
