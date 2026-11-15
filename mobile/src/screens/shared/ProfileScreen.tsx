import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { DrawerActions } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Icon } from '../../components/Icon';
import { InfoCard, InfoRow } from '../../components/InfoCard';
import { radius, colors } from '../../theme/tokens';
import { createTypedClient } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import type { ProfileStackParamList } from '../../navigation/ProfileNavigator';
import type { paths } from '../../api/generated/007-user-profile-management';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Profile'>;

const client = createTypedClient<paths>();

type Profile = {
  name: string;
  username: string;
  email: string;
  role: string;
  category?: string | null;
  department?: string | null;
  company?: string | null;
};

/**
 * UI Design §4.10 — common to every role (this task's own ask): Name/
 * Username read-only, Email + role-appropriate Category/Department/Company,
 * Edit/Change Password/Logout actions.
 */
const ROLE_LABELS: Record<string, string> = {
  student: 'Student',
  company_admin: 'Company Admin',
  company_staff: 'Staff',
  system_admin: 'System Admin',
  teaching: 'Teaching Staff',
  non_teaching: 'Non-Teaching Staff',
};

export function ProfileScreen({ navigation }: Props) {
  const { signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await client.GET('/me/profile', {});
    if (!error && data) {
      setProfile(data as Profile);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation, load]);

  if (loading || !profile) {
    return (
      <Screen title="Profile" specRef="UI Design §4.10">
        <ActivityIndicator />
      </Screen>
    );
  }

  // The artboard shows a human label ("Student"), not the raw role claim
  // ("company_admin") — that string is a permission-system value and reads
  // as debug output. Unknown roles fall back to a title-cased form rather
  // than disappearing, so a future role still renders something sensible.
  const roleLabel = (r: string) =>
    ROLE_LABELS[r] ?? r.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  // Named once so the outline, the glyph and the label cannot drift
  // apart; the artboard draws all three in the same tone.
  const logoutTone = colors.danger;

  return (
    <Screen title="Profile" scroll={false}>
      <View className="flex-1 gap-md">
        {/* Header row — back control, title, Edit pill (artboard: 44px
            circle on surface with a borderSoft hairline; title Bricolage
            800 28/-0.8; Edit is an espresso pill, 44 high, 16 side pad). */}
        <View className="flex-row items-center gap-sm">
          <Pressable
            // The artboard labels this "Back to menu". Profile is reached
            // from the drawer, so there is not always a screen to pop —
            // fall back to opening the menu rather than doing nothing.
            onPress={() =>
              // "Back to menu" in the artboard. These three are DRAWER
              // destinations, not pushed routes, so canGoBack() is not a
              // reliable signal here — it consults the whole navigator tree
              // and returned true while there was nothing to pop, leaving
              // the control dead and the user with no route to the menu now
              // that the drawer header is hidden. Always open the drawer.
              navigation.dispatch(DrawerActions.openDrawer())
            }
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={{ borderWidth: 1, borderColor: colors.borderSoft }}
            className="w-touch h-touch rounded-pill bg-surface items-center justify-center"
          >
            <Icon name="chevronLeft" size={20} color={colors.espresso} />
          </Pressable>
          <Text className="flex-1 text-title text-text-primary">Profile</Text>
          <Pressable
            onPress={() => navigation.navigate('EditProfile')}
            accessibilityRole="button"
            className="h-touch px-md bg-espresso rounded-pill flex-row items-center gap-xs"
          >
            <Icon name="edit" size={16} color={colors.surface} />
            <Text className="text-label-bold text-surface">Edit</Text>
          </Pressable>
        </View>

        {/* Identity card — a ROW in the artboard (72px espresso avatar at
            radius 24, then name + role pill), with a sun disc bleeding out
            of the bottom-right corner. */}
        <View
          style={{ borderRadius: radius['6xl'], backgroundColor: colors.primary }}
          className="flex-row items-center gap-md p-lg overflow-hidden"
        >
          <View
            style={{
              position: 'absolute',
              right: -30,
              bottom: -50,
              width: 150,
              height: 150,
              borderRadius: radius.pill,
              backgroundColor: colors.accent,
            }}
          />
          <View
            style={{ width: 72, height: 72, borderRadius: radius['5xl'] }}
            className="bg-espresso items-center justify-center"
          >
            <Text className="text-display-sm text-surface">
              {profile.name.trim().charAt(0).toUpperCase()}
            </Text>
          </View>
          <View className="flex-1 gap-xs items-start">
            <Text className="text-title-sm text-espresso">{profile.name}</Text>
            {/* The ROLE badge is correct here. FR-027 bars the role from
                SIDE MENUS, where it read as debug output; on the profile
                it is information about the account the user is viewing,
                and the artboard shows it. */}
            <View className="bg-espresso rounded-pill px-sm py-glyph">
              <Text className="text-tag text-surface">{roleLabel(profile.role)}</Text>
            </View>
          </View>
        </View>

        <InfoCard>
          {/* Username is permanently read-only — not editable here or via
              the API (FR-030). The artboard marks it with a drawn lock on
              the LABEL, not a disabled input, since this is a read-only
              list rather than a form. */}
          <InfoRow label="Username" noteIcon="lock" value={profile.username} />
          <InfoRow label="Email" value={profile.email} />
          {profile.category !== undefined ? (
            <InfoRow label="Category" value={profile.category ?? '—'} />
          ) : null}
          {profile.department !== undefined ? (
            <InfoRow label="Department" value={profile.department ?? '—'} />
          ) : null}
          {profile.company !== undefined ? (
            <InfoRow label="Company" value={profile.company ?? '—'} last />
          ) : null}
        </InfoCard>

        {/* Change password is a LIST ROW in the artboard, not a filled
            button: 60px tall, a 36px tile on disabledFill, and a trailing
            chevron. */}
        <InfoCard>
          <Pressable
            onPress={() => navigation.navigate('ChangePassword')}
            accessibilityRole="button"
            style={{ height: 60 }}
            className="flex-row items-center gap-md px-md"
          >
            <View
              style={{ width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.disabledFill }}
              className="items-center justify-center"
            >
              <Icon name="lock" size={18} color={colors.espresso} />
            </View>
            <Text className="flex-1 text-body-semi text-text-primary">Change password</Text>
            <Icon name="chevronRight" size={18} color={colors.espresso} />
          </Pressable>
        </InfoCard>

        {/* Log out is an OUTLINE button pinned to the bottom — 56 high,
            1.5px rule in the red accent's strong tone. */}
        <Pressable
          onPress={() => void signOut()}
          accessibilityRole="button"
          style={{ height: 56, borderRadius: radius.pill, borderWidth: 1.5, borderColor: logoutTone }}
          className="mt-auto flex-row items-center justify-center gap-xs"
        >
          <Icon name="logout" size={18} color={logoutTone} />
          <Text style={{ color: logoutTone }} className="text-price">
            Log out
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
