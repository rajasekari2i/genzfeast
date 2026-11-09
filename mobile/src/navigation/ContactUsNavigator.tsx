import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ContactUsScreen } from '../screens/shared/ContactUsScreen';
import { primaryHeaderOptions } from '../theme/navigationHeader';

/**
 * specs/015-contact-us-page — single-screen stack, mounted as its own
 * "Contact Us" side-menu entry for every role in this tenant-scoped build
 * (AppShell.tsx), the same minimal shape ProfileNavigator.tsx had before
 * Edit/Change Password existed.
 */
export type ContactUsStackParamList = {
  ContactUs: undefined;
};

const Stack = createNativeStackNavigator<ContactUsStackParamList>();

export function ContactUsNavigator() {
  return (
    <Stack.Navigator initialRouteName="ContactUs" screenOptions={primaryHeaderOptions}>
      {/* headerShown: false — the screen renders the artboard's own header
          row (back control + Bricolage title), so leaving this on stacks
          a second cream bar above it. */}
      <Stack.Screen
        name="ContactUs"
        component={ContactUsScreen}
        options={{ title: '', headerShown: false }}
      />
    </Stack.Navigator>
  );
}
