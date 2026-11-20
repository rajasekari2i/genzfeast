import React, { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Icon } from '../../components/Icon';
import { colors } from '../../theme/tokens';
import { PasswordInput } from '../../components/PasswordInput';
import { createTypedClient } from '../../api/client';
import { DELETE_ACCOUNT_URL } from '../../config/legal';
import { useAuth } from '../../auth/AuthContext';
import type { ProfileStackParamList } from '../../navigation/ProfileNavigator';
import type { paths } from '../../api/generated/007-user-profile-management';

type Props = NativeStackScreenProps<ProfileStackParamList, 'DeleteAccount'>;

const client = createTypedClient<paths>();

/**
 * Self-service account closure. Exists because Google Play's User Data
 * policy requires any app offering account creation to offer in-app
 * deletion — there is no artboard for it, so it follows ChangePasswordScreen
 * exactly (own header row, 44px back control, Bricolage title, action pill),
 * with the pill in the danger tone rather than espresso.
 *
 * Two gates before the irreversible call: the typed password the server
 * re-verifies, and a native confirm. On success the session is already dead
 * server-side (every refresh token revoked), so this signs out locally
 * rather than navigating anywhere — RootNavigator swaps to the Auth stack
 * the moment `user` drops to null.
 */
export function DeleteAccountScreen({ navigation }: Props) {
  const { signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function submit() {
    setDeleting(true);
    try {
      const { error, response } = await client.POST('/me/delete-account', {
        body: { current_password: password },
      });

      if (error || !response.ok) {
        // 409 carries the "order waiting to be picked up" message, 401 the
        // wrong-password one — both are worth showing verbatim rather than
        // flattening into one generic line.
        setErrorMessage((error as { message?: string })?.message ?? 'Your password is incorrect.');
        setPassword('');
        return;
      }

      await signOut();
    } catch {
      setErrorMessage('Could not reach the server. Please check your connection and try again.');
    } finally {
      setDeleting(false);
    }
  }

  function handleSubmit() {
    setErrorMessage(null);

    if (!password) {
      setErrorMessage('Enter your password to confirm.');
      return;
    }

    Alert.alert(
      'Delete your account?',
      'This closes your account for good and signs you out everywhere. Your name, mobile number and email are erased. Past orders are kept as billing records, with nothing in them pointing back to you. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void submit() },
      ],
    );
  }

  return (
    <Screen title="Delete Account" scroll={false}>
      <View className="flex-1 gap-md">
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
          <Text className="flex-1 text-title text-text-primary">Delete account</Text>
          <Pressable
            onPress={handleSubmit}
            disabled={deleting}
            accessibilityRole="button"
            accessibilityLabel="Delete my account"
            accessibilityState={{ disabled: deleting }}
            style={{ backgroundColor: colors.danger, opacity: deleting ? 0.6 : 1 }}
            className="h-touch px-md rounded-pill flex-row items-center gap-xs"
          >
            {deleting ? (
              <ActivityIndicator size="small" color={colors.surface} />
            ) : (
              <Icon name="trash" size={16} color={colors.surface} />
            )}
            <Text className="text-label-bold text-surface">Delete</Text>
          </Pressable>
        </View>

        <Text className="text-body text-text-secondary">
          Closing your account signs you out of every device and erases your name, mobile number and
          email. Past orders are kept as billing records, with nothing in them pointing back to you.
          This cannot be undone.
        </Text>

        <Text className="text-body text-text-secondary">
          If an order is paid for and still waiting at the counter, pick it up first — your account
          can be closed straight after.
        </Text>

        {/* The same page Play's Data safety form points at, so the
            itemised erased/kept breakdown is one tap away at the moment
            someone is actually deciding. */}
        <Pressable
          onPress={() => void Linking.openURL(DELETE_ACCOUNT_URL)}
          accessibilityRole="link"
          className="flex-row items-center gap-xs"
        >
          <Text className="text-body-semi text-text-primary">What happens to your data</Text>
          <Icon name="arrowRight" size={16} color={colors.espresso} />
        </Pressable>

        <View className="gap-md">
          <PasswordInput placeholder="Your password" value={password} onChangeText={setPassword} />
          {errorMessage ? <Text className="text-body text-red-strong">{errorMessage}</Text> : null}
        </View>
      </View>
    </Screen>
  );
}
