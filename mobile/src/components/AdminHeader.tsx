import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, size, typography } from '../theme/tokens';

/**
 * The back-of-house top bar, measured off the "Company Admin · Dashboard"
 * artboard in docs/ui-screen/GenzFeast-Admin-and-Staff.html:
 *
 *   background: #183153 (navy)   border-radius: 0 0 32px 32px
 *   padding: 14px 20px 26px      column, gap 20
 *     row 1 (gap 10): 44px circular menu button on #23426B
 *                     · 32px logo, radius 9
 *                     · wordmark Bricolage 800 20px/-0.5, "Feast" in brand
 *                     · role tag Inter 600 12px #BCCBE0
 *                     · 44px circular avatar on brand, espresso initial
 *     row 2 (gap 6):  per-screen content (`children`)
 *
 * This replaces React Navigation's stock stack header on these screens —
 * a native header cannot produce the rounded bottom corners, the inset
 * circular controls, or the second row, so the admin/staff stack sets
 * `headerShown: false` and screens render this instead. Route names and
 * params are untouched (FR-028); only the chrome changes.
 *
 * Why no SVG: react-native-svg is not a dependency of this project, so the
 * three-bar menu glyph is composed from Views. The artboard's own path
 * (`M4 7h16 M4 12h16 M4 17h10`, stroke 2.2 in a 24 viewBox) has a SHORTER
 * third bar — that asymmetry is part of the mark, not an accident.
 */
export function AdminHeader({
  role,
  initial,
  onOpenMenu,
  children,
}: {
  /** The tag beside the wordmark. Never the user's role *name* — see FR-027. */
  role: 'ADMIN' | 'STAFF';
  /** Single letter shown in the avatar circle. */
  initial: string;
  onOpenMenu: () => void;
  /** Row two — the greeting block, a title, or nothing. */
  children?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        backgroundColor: colors.primaryVariant,
        borderBottomLeftRadius: radius['7xl'],
        borderBottomRightRadius: radius['7xl'],
        paddingTop: insets.top + 14,
        paddingHorizontal: 20,
        paddingBottom: 26,
        gap: 20,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open menu"
          onPress={onOpenMenu}
          style={{
            width: size.touch,
            height: size.touch,
            borderRadius: size.touch / 2,
            backgroundColor: colors.navyTint,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
          }}
        >
          <View style={{ width: 15, height: 2, borderRadius: radius.pill, backgroundColor: colors.surface }} />
          <View style={{ width: 15, height: 2, borderRadius: radius.pill, backgroundColor: colors.surface }} />
          <View style={{ width: 9, height: 2, borderRadius: radius.pill, backgroundColor: colors.surface, marginRight: 6 }} />
        </Pressable>

        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Image
            source={require('../../assets/brand/gf-icon-v2.png')}
            // Canvas says 9px; `sm` is 10 — a 1px difference at 32px is
            // not worth a dedicated token.
            style={{ width: 32, height: 32, borderRadius: radius.sm }}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
          <Text style={{ ...typography.wordmarkSm, color: colors.surface }}>
            Genz<Text style={{ color: colors.primary }}>Feast</Text>
          </Text>
          <Text style={{ ...typography.tag, color: colors.navyMuted }}>{role}</Text>
        </View>

        <View
          style={{
            width: size.touch,
            height: size.touch,
            borderRadius: size.touch / 2,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ ...typography.bodyBold, color: colors.espresso }}>{initial}</Text>
        </View>
      </View>

      {children ? <View style={{ gap: 6 }}>{children}</View> : null}
    </View>
  );
}
