import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { FeedbackScreen } from '../screens/shared/FeedbackScreen';
import { primaryHeaderOptions } from '../theme/navigationHeader';

/**
 * specs/016-feedback-management User Story 1 — single-screen stack, mounted
 * as its own "Feedback" side-menu entry for every tenant role (AppShell.tsx),
 * the same minimal shape ContactUsNavigator.tsx (specs/015) already uses.
 */
export type FeedbackStackParamList = {
  Feedback: undefined;
};

const Stack = createNativeStackNavigator<FeedbackStackParamList>();

export function FeedbackNavigator() {
  return (
    <Stack.Navigator initialRouteName="Feedback" screenOptions={primaryHeaderOptions}>
      <Stack.Screen name="Feedback" component={FeedbackScreen} options={{ title: '' }} />
    </Stack.Navigator>
  );
}
