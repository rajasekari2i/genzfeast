import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { HeroCard } from '../../components/HeroCard';
import { InfoCard, InfoRow } from '../../components/InfoCard';
import { radius } from '../../theme/tokens';
import { PrimaryButton } from '../../components/PrimaryButton';
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

  return (
    <Screen title="Profile">
      <View className="gap-md">
        <View className="flex-row items-center justify-between">
          <Text className="text-title text-text-primary">Profile</Text>
          <Pressable
            onPress={() => navigation.navigate('EditProfile')}
            accessibilityRole="button"
            className="h-touch px-md bg-espresso rounded-pill items-center justify-center"
          >
            <Text className="text-labelLg text-surface">Edit</Text>
          </Pressable>
        </View>

        <HeroCard className="items-center gap-sm">
          <View
            style={{ borderRadius: radius['5xl'] }}
            className="w-6xl h-6xl bg-espresso items-center justify-center"
          >
            <Text className="text-titleSm text-surface">
              {profile.name.trim().charAt(0).toUpperCase()}
            </Text>
          </View>
          <View className="items-center gap-xs">
            <Text className="text-titleSm text-espresso">{profile.name}</Text>
            {/* The ROLE badge is correct here. FR-027 bars the role from
                SIDE MENUS, where it read as debug output; on the profile
                it is information about the account the user is viewing,
                and the artboard shows it. */}
            <View className="bg-espresso rounded-pill px-sm py-xs">
              <Text className="text-caption text-surface">{profile.role}</Text>
            </View>
          </View>
        </HeroCard>

        <InfoCard>
          {/* Username is permanently read-only — not editable here or via
              the API (FR-030). The lock glyph says so without a disabled
              input, since this is a read-only list, not a form. */}
          <InfoRow label="Username" note="🔒" value={profile.username} />
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

        <View className="gap-sm">
          <PrimaryButton label="Change password" onPress={() => navigation.navigate('ChangePassword')} />
          <Pressable
            onPress={() => void signOut()}
            accessibilityRole="button"
            className="h-control items-center justify-center"
          >
            <Text className="text-bodyBold text-link">Log out</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}
