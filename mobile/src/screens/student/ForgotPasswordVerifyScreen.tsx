import React, { useCallback, useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import { createTypedClient } from '../../api/client';
import { getBuildCompanyId } from '../../config/tenant';
import { consumePendingResetCode } from '../../notifications/pendingResetCode';
import type { paths } from '../../api/generated/003-forgot-password-otp-reset';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPasswordVerify'>;

const client = createTypedClient<paths>();

/**
 * UI Design §4.4. Fields: OTP, New Password, Retype Password. A client-side
 * mismatch is rejected before the API is ever called (FR-008); the server's
 * generic error is shown as-is for a wrong/expired/exhausted code (FR-012) —
 * fields are left untouched either way so the user can correct and resubmit.
 *
 * User Story 3's FCM data-payload fallback: whenever this screen gains
 * focus, it checks for a code the background task or foreground listener
 * (src/notifications/passwordResetPush.ts) already wrote and pre-fills it —
 * covers both "push arrived while this screen was already open" and
 * "push arrived while backgrounded, user reopens the app." Not verified
 * against a real device/Firebase project in this session (see that file's
 * own note); manual entry always still works regardless.
 */
export function ForgotPasswordVerifyScreen({ route, navigation }: Props) {
  const { username } = route.params;
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [retypePassword, setRetypePassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const pending = await consumePendingResetCode();
        if (pending && !cancelled) {
          setCode(pending);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  async function handleSubmit() {
    setErrorMessage(null);

    if (!code.trim() || !newPassword || !retypePassword) {
      setErrorMessage('Please fill in the code, new password, and retype password.');
      return;
    }
    if (newPassword !== retypePassword) {
      setErrorMessage('New password and retype password do not match.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await client.POST('/auth/forgot-password/verify', {
        body: {
          username,
          company_id: getBuildCompanyId(),
          code: code.trim(),
          new_password: newPassword,
          retype_password: retypePassword,
        },
      });

      if (error) {
        setErrorMessage(error.message ?? 'That code is invalid or has expired. Please try again.');
        return;
      }

      Alert.alert(data.message ?? 'Your password has been reset. Please log in with your new password.');
      navigation.replace('Login');
    } catch {
      setErrorMessage('Could not reach the server. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen title="Verify OTP" specRef="UI Design §4.4">
      <View className="gap-3">
        <Text className="text-body text-text-secondary">
          Enter the code sent to your device, along with your new password.
        </Text>
        <TextInput
          className="border border-border rounded-lg px-3 py-2 text-text-primary"
          placeholder="6-character code"
          autoCapitalize="characters"
          maxLength={6}
          value={code}
          onChangeText={setCode}
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
          placeholder="Retype Password"
          secureTextEntry
          value={retypePassword}
          onChangeText={setRetypePassword}
        />
        {errorMessage ? <Text className="text-body text-red-600">{errorMessage}</Text> : null}
        <PrimaryButton label="Reset Password" onPress={handleSubmit} loading={loading} disabled={loading} />
      </View>
    </Screen>
  );
}
