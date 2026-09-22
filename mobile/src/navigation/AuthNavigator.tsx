import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SplashScreen } from '../screens/student/SplashScreen';
import { LoginScreen } from '../screens/student/LoginScreen';
import { RegisterScreen } from '../screens/student/RegisterScreen';
import { ForgotPasswordRequestScreen } from '../screens/student/ForgotPasswordRequestScreen';
import { ForgotPasswordVerifyScreen } from '../screens/student/ForgotPasswordVerifyScreen';
import { primaryHeaderOptions } from '../theme/navigationHeader';
import { colors } from '../theme/tokens';

/**
 * The pre-login stack — shared by every role (one app, not separate apps
 * per role). Rendered by RootNavigator only while AuthContext's `user` is
 * null; a successful Login/Register calls `useAuth().signIn(...)` rather
 * than navigating anywhere, which flips RootNavigator over to AppShell.
 */
export type AuthStackParamList = {
  Splash: undefined;
  Login: undefined;
  // specs/014-msg91-sms-otp-mobile-verification — mobile-number verification
  // is folded directly into RegisterScreen, no separate route/params needed.
  Register: undefined;
  ForgotPasswordRequest: undefined;
  ForgotPasswordVerify: { username: string };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator initialRouteName="Splash" screenOptions={{ ...primaryHeaderOptions, headerShown: false }}>
      <Stack.Screen name="Splash" component={SplashScreen} />
      {/* Header bar stays shown (for the back gesture area) but matches the
          screen's own background instead of the brand-orange used
          elsewhere in this stack — the logo/tagline hero underneath already
          identifies the screen, so a contrasting header bar here was just
          an unwanted stripe, not a deliberate title bar (Login only). */}
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{
          headerShown: true,
          title: '',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.textPrimary,
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: true, title: 'Register' }} />
      <Stack.Screen
        name="ForgotPasswordRequest"
        component={ForgotPasswordRequestScreen}
        options={{ headerShown: true, title: 'Forgot Password' }}
      />
      <Stack.Screen
        name="ForgotPasswordVerify"
        component={ForgotPasswordVerifyScreen}
        options={{ headerShown: true, title: 'Verify OTP' }}
      />
    </Stack.Navigator>
  );
}
