import './global.css';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { RootNavigator } from './src/navigation/RootNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { AuthProvider } from './src/auth/AuthContext';
import { CartProvider } from './src/cart/CartContext';
import {
  registerForegroundResetCodeListener,
  registerPasswordResetBackgroundTask,
} from './src/notifications/passwordResetPush';
import { registerOrderNotificationTapListener } from './src/notifications/orderReadyNotifications';

export default function App() {
  useEffect(() => {
    // specs/003-forgot-password-otp-reset User Story 3 — see
    // src/notifications/passwordResetPush.ts for what these do and why
    // real-device/Firebase verification is still outstanding.
    registerPasswordResetBackgroundTask();
    const unsubscribeForeground = registerForegroundResetCodeListener();
    // specs/009-order-fcm-push-notifications FR-007 — tap-to-open.
    const unsubscribeTap = registerOrderNotificationTapListener();
    return () => {
      unsubscribeForeground();
      unsubscribeTap();
    };
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
              <StatusBar style="auto" />
            </NavigationContainer>
          </CartProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
