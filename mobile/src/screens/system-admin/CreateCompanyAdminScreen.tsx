import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import type { SystemAdminStackParamList } from '../../navigation/SystemAdminNavigator';

type Props = NativeStackScreenProps<SystemAdminStackParamList, 'CreateCompanyAdmin'>;

/** UI Design §6.3 — Name, Username, temp Password, Email (specs/001). */
export function CreateCompanyAdminScreen({ route }: Props) {
  return <Screen title="Create Company Admin" subtitle={`For company ${route.params.companyId}`} specRef="UI Design §6.3" />;
}
