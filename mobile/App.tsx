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
    return () => {
      unsubscribeForeground();
      unsubscribeTap();
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
