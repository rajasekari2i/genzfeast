import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Icon } from '../../components/Icon';
import { colors } from '../../theme/tokens';
import { PasswordInput } from '../../components/PasswordInput';
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
    <Screen title="Change Password" scroll={false}>
      <View className="flex-1 gap-md">
        {/* No artboard for this screen (FR-029), so it follows ProfileScreen:
            the same 44px back control, the same Bricolage title, and the same
            espresso action pill. Shared by every role — ProfileNavigator is
            mounted once in AppShell for all of them. */}
        <View className="flex-row items-center gap-sm">
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={{ borderWidth: 1, borderColor: colors.borderSoft }}
            className="w-touch h-touch rounded-pill bg-surface items-center justify-center"
          >
            <Icon name="chevronLeft" size={20} color={colors.espresso} />
          </Pressable>
          <Text className="flex-1 text-title text-text-primary">Change password</Text>
          <Pressable
            onPress={handleSubmit}
            disabled={saving}
            accessibilityRole="button"
            // The pill reads "Update" for width; the full intent stays on the
            // accessible label so a screen reader is not left guessing.
            accessibilityLabel="Update password"
            accessibilityState={{ disabled: saving }}
            style={{ opacity: saving ? 0.6 : 1 }}
            className="h-touch px-md bg-espresso rounded-pill flex-row items-center gap-xs"
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.surface} />
            ) : (
              <Icon name="check" size={16} color={colors.surface} />
            )}
            <Text className="text-label-bold text-surface">Update</Text>
          </Pressable>
        </View>

        <Text className="text-body text-text-secondary">
          Changing your password signs you out of your other devices.
        </Text>

        <View className="gap-md">
          <PasswordInput placeholder="Current password" value={currentPassword} onChangeText={setCurrentPassword} />
          <PasswordInput placeholder="New password" value={newPassword} onChangeText={setNewPassword} />
          <PasswordInput placeholder="Retype new password" value={retypePassword} onChangeText={setRetypePassword} />
          {errorMessage ? <Text className="text-body text-red-strong">{errorMessage}</Text> : null}
        </View>
      </View>
    </Screen>
  );
}
