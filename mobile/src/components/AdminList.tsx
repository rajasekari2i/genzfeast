import React from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';
import { accents, colors, radius, type AccentName } from '../theme/tokens';

/**
 * Back-of-house list furniture — the treatment the `Categories`,
 * `Departments`, `Users`, `AdminProducts`, `StaffProducts` and
 * `FeedbackReview` artboards all share.
 *
 * The navy band those boards draw at the top is the stack header, which
 * TenantAdminStaffNavigator already renders in navy; these are the pieces
 * that sit below it on the warm-grey ground.
 */

/** Uppercase count/section label, e.g. "4 CATEGORIES". */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text className="text-eyebrow text-text-secondary">{String(children).toUpperCase()}</Text>;
}

/** Filled search field — no visible border, the ground supplies the contrast. */
export function AdminSearchField(props: TextInputProps) {
  return (
    <View className="relative justify-center">
      <Text className="absolute left-sm text-body text-text-secondary" pointerEvents="none">
        🔍
      </Text>
      <TextInput
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="none"
        style={{ borderRadius: radius.xl }}
        className="h-field bg-surface pl-xl pr-md text-bodyLg text-text-primary"
        {...props}
      />
    </View>
  );
}

/**
 * One row of a management list: an accent icon tile, a title with optional
 * supporting line, and whatever actions the caller passes.
 *
 * The icon tile's family is chosen by the caller so each list reads as its
 * own thing at a glance — categories violet, departments blue, users
 * neutral — using the shared accent pairs rather than per-screen colours.
 */
export function AdminListRow({
  glyph,
  accent = 'neutral',
  title,
  subtitle,
  actions,
}: {
  glyph: string;
  accent?: AccentName;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  const pair = accents[accent];
  return (
    <View
      style={{ borderRadius: radius['3xl'], borderWidth: 1, borderColor: colors.borderSoft }}
      className="flex-row items-center gap-sm bg-surface p-sm pl-md min-h-touch"
    >
      <View
        style={{ backgroundColor: pair.soft, borderRadius: radius.md }}
        className="w-xl h-xl items-center justify-center"
      >
        <Text style={{ color: pair.strong }} className="text-labelLg">
          {glyph}
        </Text>
      </View>
      <View className="flex-1">
        <Text className="text-bodyBold text-text-primary" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-caption text-text-secondary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actions ? <View className="flex-row gap-xs">{actions}</View> : null}
    </View>
  );
}
