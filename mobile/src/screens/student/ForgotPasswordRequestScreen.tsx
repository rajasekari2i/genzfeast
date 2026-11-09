import React, { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { AuthHeader, InfoStrip } from '../../components/AuthChrome';
import { Icon } from '../../components/Icon';
import { colors, radius } from '../../theme/tokens';
import { PrimaryButton } from '../../components/PrimaryButton';
import { FormField } from '../../components/FormField';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import { createTypedClient } from '../../api/client';
import { getBuildCompanyId, getTenantDisplayName } from '../../config/tenant';
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
  const canteen = getTenantDisplayName();
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
    <Screen title="Forgot Password" scroll={false}>
      <View className="flex-1 gap-lg">
        {/* Section 03. The artboard replaces the old heading-and-field stack
            with: the shared auth header row, a 200px brand hero carrying a
            rotated key tile and two decorative discs, a 30/34 headline, the
            field, an amber advisory about delivery channel, then the action
            and a "Remembered it?" line pinned to the bottom. */}
        <AuthHeader onBack={() => navigation.goBack()} canteen={canteen} />

        <View
          style={{ height: 200, borderRadius: radius['7xl'], backgroundColor: colors.primary }}
          className="items-center justify-center overflow-hidden"
        >
          <View
            style={{
              position: 'absolute',
              left: -36,
              bottom: -48,
              width: 150,
              height: 150,
              borderRadius: radius.pill,
              backgroundColor: colors.accent,
            }}
          />
          <View
            style={{
              position: 'absolute',
              right: 28,
              top: 22,
              width: 18,
              height: 18,
              borderRadius: radius.pill,
              backgroundColor: colors.background,
              opacity: 0.6,
            }}
          />
          <View
            style={{
              width: 104,
              height: 104,
              borderRadius: radius.sheet,
              backgroundColor: colors.espresso,
              transform: [{ rotate: '-8deg' }],
            }}
            className="items-center justify-center"
          >
            <Icon name="lock" size={44} color={colors.accent} />
          </View>
        </View>

        <View className="gap-xs">
          <Text className="text-display-xs text-text-primary">Forgot password?</Text>
          <Text className="text-body-lg text-text-secondary">
            No stress. Enter your username and we'll send a one-time code to reset it.
          </Text>
        </View>

        <View className="gap-md">
          <FormField
            label="Username (mobile number)"
            placeholder="10-digit mobile"
            keyboardType="phone-pad"
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
          />
          <InfoStrip icon="clock" accent="sun">
            The code arrives by SMS or as a notification on this phone, depending on your canteen.
          </InfoStrip>
        </View>

        <View className="mt-auto gap-md">
          <PrimaryButton
            label="Send code"
            trailingIcon="arrowRight"
            onPress={handleSubmit}
            loading={loading}
            disabled={loading}
          />
          <View className="flex-row justify-center items-center gap-xs">
            <Text className="text-body text-text-secondary">Remembered it?</Text>
            <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" hitSlop={8}>
              <Text className="text-body-bold text-link">Log in</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Screen>
  );
}
