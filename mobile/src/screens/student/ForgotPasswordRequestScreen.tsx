import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { FormField } from '../../components/FormField';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import { createTypedClient } from '../../api/client';
import { getBuildCompanyId } from '../../config/tenant';
import { getDevicePushToken } from '../../notifications/pushToken';
import type { paths } from '../../api/generated/003-forgot-password-otp-reset';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPasswordRequest'>;

const client = createTypedClient<paths>();

/**
 * UI Design §4.3. Field: Username. Always proceeds to Verify on a successful
 * call, regardless of whether the account actually exists — the endpoint's
 * response is identical either way (FR-004), so branching on it client-side
 * would defeat the anti-enumeration guarantee (specs/003-forgot-password-otp-reset).
 */
export function ForgotPasswordRequestScreen({ navigation }: Props) {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!username.trim()) {
      Alert.alert('Enter your username to continue.');
      return;
    }

    setLoading(true);
    try {
      // FR-017: best-effort — a null token (no Firebase configured, denied
      // permission, or a simulator) is submitted as undefined and never
      // blocks the request itself (research.md §7).
      const fcmToken = await getDevicePushToken();
      const { error } = await client.POST('/auth/forgot-password/request', {
        body: {
          username: username.trim(),
          company_id: getBuildCompanyId(),
          fcm_token: fcmToken ?? undefined,
        },
      });

      if (error) {
        Alert.alert('Something went wrong. Please try again.');
        return;
      }

      navigation.navigate('ForgotPasswordVerify', { username: username.trim() });
    } catch {
      Alert.alert('Could not reach the server. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen title="Forgot Password">
      <View className="gap-lg">
        {/* No artboard for this screen (FR-029) — composed from Login's
            own heading + field + primary-button pattern, with no new
            layout invented. */}
        <View className="gap-xs">
          <Text className="text-title text-text-primary">Forgot password?</Text>
          <Text className="text-body text-text-secondary">
            Enter your username and we'll send a one-time code to reset your password.
          </Text>
        </View>
        <FormField
          label="Username (mobile number)"
          placeholder="9876543210"
          keyboardType="phone-pad"
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
        />
        <PrimaryButton label="Send code" onPress={handleSubmit} loading={loading} disabled={loading} />
      </View>
    </Screen>
  );
}
