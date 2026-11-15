import React, { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { AuthHeader, Highlight, InfoStrip } from '../../components/AuthChrome';
import { Icon } from '../../components/Icon';
import { colors, radius } from '../../theme/tokens';
import { PrimaryButton } from '../../components/PrimaryButton';
import { PasswordInput } from '../../components/PasswordInput';
import { OtpInput } from '../../components/OtpInput';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import { createTypedClient } from '../../api/client';
import { getTenantDisplayName } from '../../config/tenant';
import { getBuildCompanyId } from '../../config/tenant';
import type { paths } from '../../api/generated/003-forgot-password-otp-reset';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPasswordVerify'>;

const client = createTypedClient<paths>();

/**
 * UI Design §4.4. Fields: OTP, New Password, Retype Password. A client-side
 * mismatch is rejected before the API is ever called (FR-008); the server's
 * generic error is shown as-is for a wrong/expired/exhausted code (FR-012) —
 * fields are left untouched either way so the user can correct and resubmit.
 *
 * Revised (per-Company `is_sms` routing): the code always arrives as
 * something the user reads and types in themselves — a visible push
 * notification (src/notifications/passwordResetPush.ts) when the user's
 * Company has `is_sms=false`, or an SMS when `is_sms=true` — so this screen
 * no longer auto-fills from a silently-stored code.
 */
export function ForgotPasswordVerifyScreen({ route, navigation }: Props) {
  const canteen = getTenantDisplayName();
  const { username } = route.params;
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [retypePassword, setRetypePassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    <Screen title="Verify OTP" scroll={false}>
      <View className="flex-1 gap-md">
        {/* Section 04. The code entry moves INTO a white card with its own
            label and helper line — the artboard does not leave the boxes
            loose on the ground — and the headline highlights "messages" on a
            brand plate. */}
        <AuthHeader onBack={() => navigation.goBack()} canteen={canteen} />

        <View className="gap-xs">
          <View className="flex-row flex-wrap items-center">
            <Text className="text-display-xs text-text-primary">Check your </Text>
            <Highlight textClassName="text-display-xs text-espresso">messages</Highlight>
          </View>
          <Text className="text-body-lg text-text-secondary">
            Enter the 6-character code sent for{' '}
            <Text className="text-body-lg text-text-primary">{username}</Text>, then pick a new
            password.
          </Text>
        </View>

        <View
          accessibilityRole="none"
          style={{ borderRadius: radius['5xl'], borderWidth: 1, borderColor: colors.borderSoft }}
          className="bg-surface p-md gap-sm"
        >
          <View className="flex-row items-center gap-xs">
            <Icon name="lock" size={16} color={colors.textBody} />
            <Text className="text-label text-text-body">Reset code</Text>
          </View>
          {/* ALPHANUMERIC: the reset code is 6 characters, not 6 digits.
              Filtering to digits would silently reject a valid code. */}
          <OtpInput
            mode="alphanumeric"
            onComplete={setCode}
            error={Boolean(errorMessage)}
            editable={!loading}
            accessibilityLabel="Enter the 6-character reset code"
          />
          <Text className="text-caption text-text-secondary">
            Letters and numbers. Check your SMS or notifications.
          </Text>
        </View>

        <View className="gap-md">
          <PasswordInput placeholder="New password" value={newPassword} onChangeText={setNewPassword} />
          <PasswordInput placeholder="Retype password" value={retypePassword} onChangeText={setRetypePassword} />
          <InfoStrip icon="check" accent="mint">
            Account locked after too many tries? Resetting your password unlocks it.
          </InfoStrip>
          {errorMessage ? <Text className="text-body text-red-strong">{errorMessage}</Text> : null}
        </View>

        <View className="mt-auto gap-md">
          <PrimaryButton
            label="Reset password"
            onPress={handleSubmit}
            loading={loading}
            disabled={loading}
          />
          <View className="flex-row justify-center items-center gap-xs">
            <Text className="text-body text-text-secondary">Didn't get a code?</Text>
            <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" hitSlop={8}>
              <Text className="text-body-bold text-link">Request a new one</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Screen>
  );
}
