import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { EditProfileScreen } from '../screens/shared/EditProfileScreen';
import { ChangePasswordScreen } from '../screens/shared/ChangePasswordScreen';
import { primaryHeaderOptions } from '../theme/navigationHeader';

/**
 * specs/007-user-profile-management, UI Design §4.10/§4.11/§4.12 — one
 * shared stack, mounted as its own "Profile" side-menu entry for every role
 * (AppShell.tsx), not just Student (this task's own explicit ask).
 */
export type ProfileStackParamList = {
  Profile: undefined;
  EditProfile: undefined;
  ChangePassword: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileNavigator() {
  return (
    <Stack.Navigator initialRouteName="Profile" screenOptions={primaryHeaderOptions}>
      {/* No header title text on any screen here — the Drawer's own header (AppShell.tsx) already labels the current side-menu section next to the hamburger icon; this stack's header keeps its color/back-button but shows no duplicate text. */}
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: '' }} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: '' }} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: '' }} />
    </Stack.Navigator>
  );
}
