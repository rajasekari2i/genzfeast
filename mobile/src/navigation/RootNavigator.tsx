import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AuthNavigator } from './AuthNavigator';
import { AppShell } from './AppShell';
import { useAuth } from '../auth/AuthContext';

/**
 * Session-driven root: one app, routed entirely by whether AuthContext has
 * a logged-in user and, if so, their role — replacing the previous dev-only
 * SurfacePicker that let a developer manually choose between three
 * separately-built "surfaces." See AppShell.tsx for the role→menu mapping.
 */
export function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }

  return user ? <AppShell /> : <AuthNavigator />;
}
