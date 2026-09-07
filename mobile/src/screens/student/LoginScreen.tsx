import React, { useState } from 'react';
import { Alert, Image, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { BrandRationaleSlider } from '../../components/BrandRationaleSlider';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import { createTypedClient, storeSession } from '../../api/client';
import { getBuildCompanyId } from '../../config/tenant';
import { useAuth } from '../../auth/AuthContext';
import type { paths } from '../../api/generated/002-registration-login-jwt-auth';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

const client = createTypedClient<paths>();

/**
 * UI Design §4.2. Fields: Username, Password. Shared entry point for every
 * role (not Student-only) — after a successful login this calls
 * `useAuth().signIn`, which flips RootNavigator over to the role-based
 * AppShell, rather than navigating to a route that may not even exist in
 * this stack for a non-Student role.
 */
export function LoginScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    <Screen title="Login" specRef="UI Design §4.2">
      <View className="items-center gap-1 mb-6">
        <Image
          source={require('../../../assets/brand/genzfeast-login-logo.png')}
          style={{ width: 220, height: 169 }}
          resizeMode="contain"
          accessibilityLabel="GenzFeast"
        />
        <Text className="text-body-bold text-text-secondary text-center">Good Food Meets Greater Tomorrows</Text>
      </View>
      <View className="gap-3">
        <TextInput
          className="border border-border rounded-lg px-3 py-2 text-text-primary"
          placeholder="Username (mobile number)"
          keyboardType="phone-pad"
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          className="border border-border rounded-lg px-3 py-2 text-text-primary"
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        {errorMessage ? <Text className="text-body text-red-600">{errorMessage}</Text> : null}
        <PrimaryButton label="Login" onPress={handleSubmit} loading={loading} disabled={loading} />
        <Text className="text-center text-slate-500" onPress={() => navigation.navigate('ForgotPasswordRequest')}>
          Forgot password?
        </Text>
        <Text className="text-center text-slate-500 mt-4" onPress={() => navigation.navigate('Register')}>
          New here? Register
        </Text>
      </View>
      <BrandRationaleSlider />
    </Screen>
  );
}
