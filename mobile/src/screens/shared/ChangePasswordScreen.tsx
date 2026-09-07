import React, { useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { createTypedClient, getStoredRefreshToken } from '../../api/client';
import type { ProfileStackParamList } from '../../navigation/ProfileNavigator';
import type { paths } from '../../api/generated/007-user-profile-management';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ChangePassword'>;

const client = createTypedClient<paths>();

/**
 * UI Design §4.12 — client-side new/retype match check before submit
 * (FR-010 also enforces this server-side); wrong current password shows an
 * inline error and clears for retry (FR-011); success revokes every other
 * session (FR-012) — the stored refresh token is sent so THIS session
 * survives, matching 002's /auth/logout self-identification pattern.
 */
export function ChangePasswordScreen({ navigation }: Props) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [retypePassword, setRetypePassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    setErrorMessage(null);

    if (!currentPassword || !newPassword || !retypePassword) {
      setErrorMessage('Fill in all three fields.');
      return;
    }
    if (newPassword !== retypePassword) {
      setErrorMessage('New password and retype password do not match.');
      return;
    }

    setSaving(true);
    try {
      const refreshToken = await getStoredRefreshToken();
      const { data, error } = await client.POST('/me/change-password', {
        body: {
          current_password: currentPassword,
          new_password: newPassword,
          retype_password: retypePassword,
          ...(refreshToken ? { refresh_token: refreshToken } : {}),
        },
      });

      if (error) {
        setErrorMessage((error as { message?: string })?.message ?? 'Current password is incorrect.');
        setCurrentPassword('');
        return;
      }

      Alert.alert(data.message ?? "Password updated. You've been logged out of other devices.");
      navigation.navigate('Profile');
    } catch {
      setErrorMessage('Could not reach the server. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen title="Change Password" specRef="UI Design §4.12">
      <View className="gap-3">
        <TextInput
          className="border border-border rounded-lg px-3 py-2 text-text-primary"
          placeholder="Current Password"
          secureTextEntry
          value={currentPassword}
          onChangeText={setCurrentPassword}
        />
        <TextInput
          className="border border-border rounded-lg px-3 py-2 text-text-primary"
          placeholder="New Password"
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
        />
        <TextInput
          className="border border-border rounded-lg px-3 py-2 text-text-primary"
          placeholder="Retype New Password"
          secureTextEntry
          value={retypePassword}
          onChangeText={setRetypePassword}
        />
        {errorMessage ? <Text className="text-body text-red-600">{errorMessage}</Text> : null}
        <PrimaryButton label="Update Password" onPress={handleSubmit} loading={saving} disabled={saving} />
      </View>
    </Screen>
  );
}
