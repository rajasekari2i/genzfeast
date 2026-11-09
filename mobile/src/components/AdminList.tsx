import React from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';
import { accents, colors, radius, type AccentName } from '../theme/tokens';
import { Icon } from './Icon';
import type { IconName } from './Icon';

/**
 * Back-of-house list furniture — the treatment the `Categories`,
 * `Departments`, `Users`, `AdminProducts`, `StaffProducts` and
 * `FeedbackReview` artboards all share.
 *
 * The navy band those boards draw at the top is the stack header, which
 * TenantAdminStaffNavigator already renders in navy; these are the pieces
 * that sit below it on the warm-grey ground.
 */

/**
 * A square accent tile holding a glyph. Callers pass an accent NAME, never
 * colours — contract O3: a screen must not choose an accent family by hand,
 * or the families drift apart again.
 */
export function IconTile({
  glyph,
  icon,
  accent = 'neutral',
  size = 'sm',
}: {
  /** An emoji/text glyph. Prefer `icon` — the artboards use line icons. */
  glyph?: string;
  /** A line icon transcribed from the artboards. Takes precedence over `glyph`. */
  icon?: IconName;
  accent?: AccentName;
  /** 'tile' is a 40px list-row tile (radius 12); 'md' the 44px quick-link tile (radius 14). */
  size?: 'sm' | 'tile' | 'md' | 'lg';
}) {
  // This component owns the accents lookup on purpose: gate O3 forbids a
  // SCREEN importing the `accents` map and picking a family by hand, so the
  // screen names a family and this resolves the soft/strong pair.
  const pair = accents[accent];
  const box =
    size === 'lg'
      ? 'w-control h-control'
      : size === 'md'
        ? 'w-touch h-touch'
        : size === 'tile'
          ? 'w-tile h-tile'
          : 'w-xl h-xl';
  const corner = size === 'lg' ? radius['2xl'] : size === 'md' ? radius.lg : radius.md;

  return (
    <View
      style={{ backgroundColor: pair.soft, borderRadius: corner }}
      className={`${box} items-center justify-center`}
    >
      {icon ? (
        <Icon name={icon} size={size === 'lg' ? 26 : 22} color={pair.strong} />
      ) : (
        <Text style={{ color: pair.strong }} className={size === 'lg' ? 'text-subtitle' : 'text-label-lg'}>
          {glyph}
        </Text>
      )}
    </View>
  );
}

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
        className="h-field bg-surface pl-xl pr-md text-body-lg text-text-primary"
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
        <Text style={{ color: pair.strong }} className="text-label-lg">
          {glyph}
        </Text>
      </View>
      <View className="flex-1">
        <Text className="text-body-bold text-text-primary" numberOfLines={1}>
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
