import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
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
    <Screen title="Profile" specRef="UI Design §4.10">
      <View className="gap-4">
        <View className="gap-3">
          <Field label="Name" value={profile.name} />
          <Field label="Username" value={profile.username} />
          <Field label="Email" value={profile.email} />
          {profile.category !== undefined ? <Field label="Category" value={profile.category ?? '—'} /> : null}
          {profile.department !== undefined ? <Field label="Department" value={profile.department ?? '—'} /> : null}
          {profile.company !== undefined ? <Field label="Company" value={profile.company ?? '—'} /> : null}
        </View>

        <PrimaryButton label="Edit Profile" onPress={() => navigation.navigate('EditProfile')} />
        <PrimaryButton label="Change Password" onPress={() => navigation.navigate('ChangePassword')} />
        <PrimaryButton label="Logout" onPress={() => void signOut()} />
      </View>
    </Screen>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View className="border-b border-border pb-2">
      <Text className="text-caption text-text-secondary">{label}</Text>
      <Text className="text-body text-text-primary">{value}</Text>
    </View>
  );
}
