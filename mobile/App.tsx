import './global.css';
import React, { useEffect } from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { RootNavigator } from './src/navigation/RootNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { AuthProvider } from './src/auth/AuthContext';
import { CartProvider } from './src/cart/CartContext';
import { registerForegroundResetCodeListener } from './src/notifications/passwordResetPush';
import { registerOrderNotificationTapListener } from './src/notifications/orderReadyNotifications';
import { requestIgnoreBatteryOptimizations } from './src/notifications/batteryOptimization';
import { getDevicePushToken } from './src/notifications/pushToken';
import {
  ensureMobileVerificationChannel,
  registerForegroundMobileVerificationListener,
} from './src/notifications/mobileVerificationPush';

const HAS_PROMPTED_BATTERY_OPTIMIZATION_KEY = 'genzfeast.hasPromptedBatteryOptimization';

export default function App() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    // specs/003-forgot-password-otp-reset User Story 3 — the background
    // handler is registered in index.ts (outside the React tree, per
    // @react-native-firebase/messaging's requirement); see
    // src/notifications/passwordResetPush.ts for what this foreground
    // listener does and why real-device/Firebase verification is still
    // outstanding.
    const unsubscribeForeground = registerForegroundResetCodeListener();
    // specs/009-order-fcm-push-notifications FR-007 — tap-to-open.
    const unsubscribeTap = registerOrderNotificationTapListener();
    // specs/014-msg91-sms-otp-mobile-verification — registered here,
    // unconditionally, rather than inside RegisterScreen: the server sends
    // this push during the same HTTP call RegisterScreen awaits, so a
    // listener only subscribed after that call resolves can race the push
    // and miss it (see mobileVerificationPush.ts's own note).
    ensureMobileVerificationChannel();
    const unsubscribeMobileVerification = registerForegroundMobileVerificationListener();
    // Ask for notification permission as early as possible — the first
    // app launch after install — rather than waiting until the student
    // reaches Register/ForgotPassword and taps something that needs it.
    // This is the native OS Allow/Deny dialog (Android 13+'s
    // POST_NOTIFICATIONS runtime permission); there's no way to grant it
    // during installation itself, only to ask for it as soon as the app
    // opens. If a prior install already got a hard "Deny" on this exact
    // device, Android suppresses the dialog on every future call — no code
    // change can force it back; only the user re-enabling it in system
    // Settings, or a full uninstall/reinstall (which resets the OS's
    // per-package permission state), makes this prompt reappear.
    getDevicePushToken();
    return () => {
      unsubscribeForeground();
      unsubscribeTap();
      unsubscribeMobileVerification();
    };
  }, []);

  useEffect(() => {
    // One-tap battery-optimization exemption prompt (see
    // src/notifications/batteryOptimization.ts) — once per install, never
    // re-asked regardless of the user's answer; the flag is set either way.
    (async () => {
      const alreadyPrompted = await AsyncStorage.getItem(HAS_PROMPTED_BATTERY_OPTIMIZATION_KEY);
      if (alreadyPrompted) {
        return;
      }
      await requestIgnoreBatteryOptimizations();
      await AsyncStorage.setItem(HAS_PROMPTED_BATTERY_OPTIMIZATION_KEY, 'true');
    })();
  }, []);

  return (
    // Required by react-native-gesture-handler, a peer dep of
    // @react-navigation/drawer (the role-based side menu, AppShell.tsx).
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <CartProvider>
            <NavigationContainer ref={navigationRef}>
              <RootNavigator />
              <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
            </NavigationContainer>
          </CartProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
