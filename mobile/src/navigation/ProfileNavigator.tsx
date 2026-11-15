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
      {/* headerShown: false — the Profile artboard has no chrome above it; the
          screen renders its own header row (back control, title, Edit pill).
          EditProfile and ChangePassword keep the stack header, since their
          artboards do not carry a back control of their own. */}
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: '', headerShown: false }}
      />
      {/* headerShown: false — EditProfile now renders ProfileScreen's header
          row (back control, Bricolage title, espresso action pill), so the
          stack header would stack a second, empty cream bar above it. */}
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ title: '', headerShown: false }}
      />
      {/* headerShown: false — same reason as EditProfile above: the screen
          renders its own header row, so the stack header would stack an
          empty cream bar over it. Every route in this stack now owns its
          own chrome. */}
      <Stack.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{ title: '', headerShown: false }}
      />
    </Stack.Navigator>
  );
}
