import React from 'react';
import { Pressable, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CompanyListScreen } from '../screens/system-admin/CompanyListScreen';
import { CompanyCreateEditScreen } from '../screens/system-admin/CompanyCreateEditScreen';
import { CreateCompanyAdminScreen } from '../screens/system-admin/CreateCompanyAdminScreen';
import { UserListScreen } from '../screens/system-admin/UserListScreen';
import { UserCreateEditScreen } from '../screens/system-admin/UserCreateEditScreen';
import { secondaryHeaderOptions } from '../theme/navigationHeader';
import { colors } from '../theme/tokens';

/**
 * System Admin Portal — a role-gated section of this same codebase, not a
 * separate app (specs/001-company-role-user-setup/research.md §7). UI
 * Design §6. Mounted twice by AppShell.tsx at different initialRouteNames
 * ("Companies" / "Users" drawer items), the same parameterized-entry-point
 * pattern TenantAdminStaffNavigator already uses.
 */
export type SystemAdminStackParamList = {
  CompanyList: undefined;
  CompanyCreateEdit: { companyId?: string };
  CreateCompanyAdmin: { companyId: string };
  UserList: undefined;
  UserCreate: { userId?: string };
};

const Stack = createNativeStackNavigator<SystemAdminStackParamList>();

export function SystemAdminNavigator({
  initialRouteName = 'CompanyList',
}: {
  initialRouteName?: 'CompanyList' | 'UserList';
}) {
  return (
    <Stack.Navigator initialRouteName={initialRouteName} screenOptions={secondaryHeaderOptions}>
      {/* No header title text on any screen here — the Drawer's own header (AppShell.tsx) already shows the current section name next to the hamburger icon; this stack's own header previously repeated it right below. Bar color/back-button unchanged. */}
      <Stack.Screen
        name="CompanyList"
        component={CompanyListScreen}
        options={({ navigation }) => ({
          title: '',
          headerRight: () => (
            <Pressable onPress={() => navigation.navigate('CompanyCreateEdit', {})} hitSlop={8}>
              <Text style={{ color: colors.surface, fontWeight: '700', fontSize: 15 }}>+ Add</Text>
            </Pressable>
          ),
        })}
      />
      <Stack.Screen name="CompanyCreateEdit" component={CompanyCreateEditScreen} options={{ title: '' }} />
      <Stack.Screen name="CreateCompanyAdmin" component={CreateCompanyAdminScreen} options={{ title: '' }} />
      <Stack.Screen
        name="UserList"
        component={UserListScreen}
        options={({ navigation }) => ({
          title: '',
          headerRight: () => (
            <Pressable onPress={() => navigation.navigate('UserCreate', {})} hitSlop={8}>
              <Text style={{ color: colors.surface, fontWeight: '700', fontSize: 15 }}>+ Add</Text>
            </Pressable>
          ),
        })}
      />
      <Stack.Screen name="UserCreate" component={UserCreateEditScreen} options={{ title: '' }} />
    </Stack.Navigator>
  );
}
