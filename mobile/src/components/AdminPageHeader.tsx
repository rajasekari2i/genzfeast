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
 *                       (+ optional 12px #BCCBE0 subtitle beneath it, as on
 *                        Categories / Departments / Users)
 *                     · optional trailing count, Inter 13px #BCCBE0
 *     row 2: `children` — the search field on the list screens, or the
 *                     segmented All/New/Resolved control on Feedback
 *
 * `meta` + `badge` switch it to the Feedback DETAIL arrangement, where row 1
 * carries a timestamp and a status pill instead of the title, and the title
 * drops to its own line at 28/30.
 *
 * Deliberately a separate component from AdminHeader, not a variant of it:
 * the dashboard header carries an identity (logo, wordmark, role tag,
 * avatar) and 32px corners, this one carries navigation (back, title, count)
 * and 28px corners. Folding both into one component would mean a prop that
 * swaps out nearly every child.
 */
export function AdminPageHeader({
  title,
  subtitle,
  count,
  meta,
  badge,
  onBack,
  children,
}: {
  title: string;
  /** 12px line under the title (Categories, Departments, Users). */
  subtitle?: string;
  /** Rendered verbatim, e.g. "24 items". Omitted when absent. */
  count?: string;
  /** Detail arrangement: a timestamp on the back row; pushes the title below. */
  meta?: string;
  /** Detail arrangement: a status pill at the end of the back row. */
  badge?: React.ReactNode;
  onBack: () => void;
  /** Row two — the search field, the segmented control, or nothing. */
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

        {meta ? (
          <Text style={{ color: colors.navyMuted }} className="flex-1 text-label" numberOfLines={1}>
            {meta}
          </Text>
        ) : (
          <View className="flex-1">
            <Text className="text-wordmark text-surface" numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={{ color: colors.navyMuted }} className="text-caption" numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        )}

        {badge}

        {count ? (
          <Text style={{ color: colors.navyMuted }} className="text-label">
            {count}
          </Text>
        ) : null}
      </View>

      {/* In the detail arrangement the title sits on its own line, a size up
          from the list screens' 26px. */}
      {meta ? <Text className="text-title text-surface">{title}</Text> : null}

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

/**
 * The segmented All / New / Resolved control that sits in row two on
 * "Company Admin · Feedback": a navyTint track with 4px padding, and the
 * selected segment a white pill with navy text.
 */
export function AdminSegmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <View
      accessibilityRole="tablist"
      style={{ flexDirection: 'row', padding: 4, borderRadius: radius.pill, backgroundColor: colors.navyTint }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(opt.value)}
            style={{
              flex: 1,
              height: 40,
              borderRadius: radius.pill,
              backgroundColor: active ? colors.surface : 'transparent',
            }}
            className="items-center justify-center"
          >
            <Text
              style={{ color: active ? colors.primaryVariant : colors.navyTabMuted }}
              className="text-label"
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * The floating brand action pill every admin list screen carries, bottom
 * right: 60px tall, 24px side padding, a plus glyph, and the artboard's navy
 * drop shadow. It replaces the old `headerRight` "+ Add" text link, which had
 * nowhere to render once these screens stopped using the native header.
 */
export function AdminFab({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        position: 'absolute',
        right: 20,
        bottom: 24,
        height: 60,
        borderRadius: radius.pill,
        backgroundColor: colors.primary,
        shadowColor: colors.primaryVariant,
        shadowOpacity: 0.25,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 10 },
        elevation: 8,
      }}
      className="px-lg flex-row items-center gap-xs"
    >
      <Icon name="plus" size={20} color={colors.espresso} />
      <Text className="text-action text-espresso">{label}</Text>
    </Pressable>
  );
}
