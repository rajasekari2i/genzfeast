import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SplashScreen } from '../screens/student/SplashScreen';
import { LoginScreen } from '../screens/student/LoginScreen';
import { RegisterScreen } from '../screens/student/RegisterScreen';
import { ForgotPasswordRequestScreen } from '../screens/student/ForgotPasswordRequestScreen';
import { ForgotPasswordVerifyScreen } from '../screens/student/ForgotPasswordVerifyScreen';
import { authHeaderOptions } from '../theme/navigationHeader';

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
    <Stack.Navigator initialRouteName="Splash" screenOptions={{ ...authHeaderOptions, headerShown: false }}>
      <Stack.Screen name="Splash" component={SplashScreen} />
      {/* Header bar stays shown (for the back gesture area) but matches the
          screen's own background — the logo/tagline hero underneath already
          identifies the screen, so a contrasting header bar here was just an
          unwanted stripe (commit c2b7b0c). specs/017-ui-refresh moves those
          values into navigationHeader.ts's authHeaderOptions rather than
          repeating them inline; routing this at primaryHeaderOptions instead
          would regress that fix. */}
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        // headerShown: false — the Login artboard has no chrome above the
        // hero card at all. c2b7b0c made this header MATCH the screen
        // background rather than be brand orange, which hid it visually but
        // still reserved its height, leaving a blank bar across the top.
        options={{ ...authHeaderOptions, headerShown: false }}
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
