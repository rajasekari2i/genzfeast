import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CompanyListScreen } from '../screens/system-admin/CompanyListScreen';
import { CompanyCreateEditScreen } from '../screens/system-admin/CompanyCreateEditScreen';
import { CreateCompanyAdminScreen } from '../screens/system-admin/CreateCompanyAdminScreen';
import { platformScopeHeaderOptions } from '../theme/navigationHeader';

/**
 * System Admin Portal — a role-gated section of this same codebase, not a
 * separate app (specs/001-company-role-user-setup/research.md §7). UI
 * Design §6.
 */
export type SystemAdminStackParamList = {
  CompanyList: undefined;
  CompanyCreateEdit: { companyId?: string };
  CreateCompanyAdmin: { companyId: string };
};

const Stack = createNativeStackNavigator<SystemAdminStackParamList>();

export function SystemAdminNavigator() {
  return (
    <Stack.Navigator initialRouteName="CompanyList" screenOptions={platformScopeHeaderOptions}>
      <Stack.Screen name="CompanyList" component={CompanyListScreen} options={{ title: 'Companies' }} />
      <Stack.Screen name="CompanyCreateEdit" component={CompanyCreateEditScreen} options={{ title: 'Company' }} />
      <Stack.Screen name="CreateCompanyAdmin" component={CreateCompanyAdminScreen} options={{ title: 'Create Company Admin' }} />
    </Stack.Navigator>
  );
}
