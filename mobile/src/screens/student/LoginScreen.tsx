import React, { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { PasswordInput } from '../../components/PasswordInput';
import { FormField } from '../../components/FormField';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import { createTypedClient, storeSession } from '../../api/client';
import { getBuildCompanyId, getTenantDisplayName } from '../../config/tenant';
import { useAuth } from '../../auth/AuthContext';
import { colors, radius } from '../../theme/tokens';
import type { paths } from '../../api/generated/002-registration-login-jwt-auth';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

const client = createTypedClient<paths>();

/**
 * Login — the `Login` artboard.
 *
 * Fields, validation and the 401-vs-403 message split are unchanged
 * (FR-030); only the layout is new: a brand-filled hero card carrying the
 * logo and tagline, then the form, then the register link pinned to the
 * bottom.
 *
 * The brand-rationale slider that used to sit under the form is not in the
 * artboard and is dropped here — it is decorative marketing content, not a
 * field, rule or flow, so removing it is a presentational change. The
 * component itself is kept and restyled rather than deleted.
 *
 * Shared entry point for every role: on success this calls signIn, which
 * flips RootNavigator to the role-based AppShell rather than navigating to
 * a route that may not exist in this stack for a non-Student role.
 */
export function LoginScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const canteen = getTenantDisplayName();

  async function handleSubmit() {
    setErrorMessage(null);
    if (!username.trim() || !password) {
      setErrorMessage('Enter your username and password.');
      return;
    }

    setLoading(true);
    try {
      const { data, error, response } = await client.POST('/auth/login', {
        body: { username: username.trim(), password, company_id: getBuildCompanyId() },
      });

      if (error) {
        // FR-014: a locked/inactive account (403) carries a distinct,
        // more specific message than a plain bad-credentials 401.
        setErrorMessage(
          error.message ??
            (response.status === 403
              ? 'Your account is locked or inactive.'
              : 'Invalid username or password.'),
        );
        return;
      }

      await storeSession(data);
      if (data.user) {
        signIn(data.user);
      }
    } catch {
      setErrorMessage('Could not reach the server. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen title="Login">
      <View className="gap-lg">
        {/* Hero: brand-filled, with a sun-coloured disc behind the mark. */}
        <View
          style={{ height: 320, borderRadius: radius['6xl'], backgroundColor: colors.primary }}
          className="p-lg justify-between overflow-hidden"
        >
          <View
            style={{
              position: 'absolute',
              width: 180,
              height: 180,
              borderRadius: radius.pill,
              backgroundColor: colors.accent,
              top: -40,
              right: -40,
            }}
          />
          {/* The rotated mark in the hero's bottom-right — 108x111 at radius
              32, tilted 10 degrees with the logo counter-rotated so it sits
              upright inside. This was missing entirely, which is why the
              card's lower right read as empty orange. */}
          <View
            style={{
              position: 'absolute',
              right: 25,
              bottom: 32,
              width: 108,
              height: 111,
              borderRadius: radius['7xl'],
              backgroundColor: colors.espresso,
              transform: [{ rotate: '10deg' }],
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Image
              source={require('../../../assets/brand/gf-mark-white.png')}
              style={{ width: 92, height: 92, transform: [{ rotate: '-10deg' }] }}
              resizeMode="contain"
              accessibilityLabel=""
            />
          </View>

          <View className="flex-row items-center gap-sm">
            <View
              style={{ width: 40, height: 40, borderRadius: radius.md }}
              className="bg-espresso items-center justify-center overflow-hidden"
            >
              <Image
                source={require('../../../assets/brand/gf-mark-white.png')}
                style={{ width: 32, height: 32 }}
                resizeMode="contain"
                accessibilityLabel=""
              />
            </View>
            <Text className="text-wordmark text-espresso">
              Genz<Text className="text-surface">Feast</Text>
            </Text>
          </View>

          {/* `hero`, not `display`: the artboard sets 40/41/-1.5 here. */}
          <Text className="text-hero text-espresso" style={{ maxWidth: 210 }}>
            Skip the queue. Grab the good stuff.
          </Text>
        </View>

        <View className="gap-xs">
          <Text className="text-title text-text-primary">Welcome back</Text>
          <Text className="text-body text-text-secondary">
            {canteen ? `Log in to order from ${canteen}` : 'Log in to order'}
          </Text>
        </View>

        <View className="gap-md">
          <FormField
            label="Username (mobile number)"
            placeholder="9876543210"
            keyboardType="phone-pad"
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
          />
          <PasswordInput placeholder="Password" value={password} onChangeText={setPassword} />

          <Pressable
            onPress={() => navigation.navigate('ForgotPasswordRequest')}
            className="self-end min-h-touch justify-center"
            accessibilityRole="button"
          >
            <Text className="text-label-lg text-link">Forgot password?</Text>
          </Pressable>

          {errorMessage ? <Text className="text-body text-red-strong">{errorMessage}</Text> : null}

          <PrimaryButton
            label="Log in"
            trailingIcon="arrowRight"
            onPress={handleSubmit}
            loading={loading}
            disabled={loading}
          />
        </View>

        <View className="flex-row justify-center items-center gap-xs">
          <Text className="text-body text-text-secondary">New here?</Text>
          <Pressable
            onPress={() => navigation.navigate('Register')}
            className="min-h-touch justify-center"
            accessibilityRole="button"
          >
            <Text className="text-body-bold text-link">Create an account</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}
