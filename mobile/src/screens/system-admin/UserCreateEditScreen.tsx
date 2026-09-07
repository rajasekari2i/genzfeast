import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { Dropdown } from '../../components/Dropdown';
import { createTypedClient } from '../../api/client';
import type { SystemAdminStackParamList } from '../../navigation/SystemAdminNavigator';
import type { paths } from '../../api/generated/001-company-role-user-setup';

type Props = NativeStackScreenProps<SystemAdminStackParamList, 'UserCreate'>;

const client = createTypedClient<paths>();

const GENDER_OPTIONS = [
  { label: 'Male', value: 'male' as const },
  { label: 'Female', value: 'female' as const },
  { label: 'Transgender', value: 'transgender' as const },
];

const ROLE_OPTIONS = [
  { label: 'Company Staff', value: 'company_staff' as const },
  { label: 'Company Admin', value: 'company_admin' as const },
];

/**
 * System Admin's cross-tenant "Create/Edit User" — Company Admin/Staff for
 * any Company (Student excluded, per this feature's own scope). No
 * GET-by-id endpoint exists for a single user (only list/create/update/
 * delete), so edit mode re-fetches the list and finds the matching row —
 * the same pattern CompanyCreateEditScreen already uses. Cancel/Update side
 * by side (Cancel left, Update right) in edit mode, Cancel/Save in create
 * mode.
 */
export function UserCreateEditScreen({ route, navigation }: Props) {
  const { userId } = route.params ?? {};
  const isEdit = Boolean(userId);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'transgender' | undefined>(undefined);
  const [role, setRole] = useState<'company_staff' | 'company_admin' | undefined>(undefined);
  const [companyId, setCompanyId] = useState<string | undefined>(undefined);
  const [companies, setCompanies] = useState<{ label: string; value: string }[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loadingUser, setLoadingUser] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await client.GET('/admin/companies');
      if (!error && data) {
        setCompanies(
          data
            .filter((c): c is { id: string; name: string } => Boolean(c.id && c.name))
            .map((c) => ({ label: c.name, value: c.id })),
        );
      }
      setLoadingCompanies(false);
    })();
  }, []);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data, error } = await client.GET('/admin/users');
      if (!error && data) {
        const existing = data.find((u) => u.id === userId);
        if (existing) {
          setName(existing.name ?? '');
          setUsername(existing.username ?? '');
          setEmail(existing.email ?? '');
          setGender(existing.gender as 'male' | 'female' | 'transgender' | undefined);
          setRole(existing.role as 'company_staff' | 'company_admin' | undefined);
          setCompanyId(existing.company_id ?? undefined);
        }
      }
      setLoadingUser(false);
    })();
  }, [userId]);

  async function handleSave() {
    const missing = [
      !name.trim() && 'Name',
      !username.trim() && 'Username',
      !isEdit && password.length < 8 && 'Password (min 8 characters)',
      isEdit && password.length > 0 && password.length < 8 && 'Password (min 8 characters)',
      !email.trim() && 'Email',
      !gender && 'Gender',
      !role && 'Role',
      !companyId && 'Company',
    ].filter((field): field is string => Boolean(field));
    if (missing.length > 0) {
      setErrorMessage(`Missing: ${missing.join(', ')}.`);
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    const { error } = userId
      ? await client.PATCH('/admin/users/{userId}', {
          params: { path: { userId } },
          body: {
            name: name.trim(),
            username: username.trim(),
            ...(password.length > 0 && { password }),
            email: email.trim(),
            gender: gender as 'male' | 'female' | 'transgender',
            role: role as 'company_staff' | 'company_admin',
            company_id: companyId as string,
          },
        })
      : await client.POST('/admin/users', {
          body: {
            name: name.trim(),
            username: username.trim(),
            password,
            email: email.trim(),
            gender: gender as 'male' | 'female' | 'transgender',
            role: role as 'company_staff' | 'company_admin',
            company_id: companyId as string,
          },
        });

    if (error) {
      setErrorMessage((error as { message?: string })?.message ?? 'Could not save user.');
      setSaving(false);
      return;
    }

    navigation.goBack();
  }

  if (loadingUser) {
    return <Screen title="Edit User" specRef="UI Design §6" />;
  }

  return (
    <Screen title={isEdit ? 'Edit User' : 'Create User'} specRef="UI Design §6">
      <View className="gap-3">
        <TextInput
          className="border border-border rounded-lg px-3 py-2 text-text-primary"
          placeholder="Name"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          className="border border-border rounded-lg px-3 py-2 text-text-primary"
          placeholder="Username (mobile number)"
          keyboardType="phone-pad"
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          className="border border-border rounded-lg px-3 py-2 text-text-primary"
          placeholder={isEdit ? 'New password (leave blank to keep current)' : 'Temporary password (min 8 characters)'}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TextInput
          className="border border-border rounded-lg px-3 py-2 text-text-primary"
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <Dropdown label="Gender" value={gender} options={GENDER_OPTIONS} onChange={setGender} placeholder="Select Gender" />
        <Dropdown label="Role" value={role} options={ROLE_OPTIONS} onChange={setRole} placeholder="Select Role" />
        <Dropdown
          label="Company"
          value={companyId}
          options={companies}
          onChange={setCompanyId}
          placeholder={loadingCompanies ? 'Loading companies...' : 'Select Company'}
        />

        {errorMessage ? <Text className="text-body text-red-600">{errorMessage}</Text> : null}

        <View className="flex-row gap-3">
          <Pressable
            className="flex-1 rounded-pill items-center justify-center px-6 py-3 border border-border"
            onPress={() => navigation.goBack()}
            disabled={saving}
          >
            <Text className="font-semibold text-center text-button text-text-secondary">Cancel</Text>
          </Pressable>
          <View className="flex-1">
            <PrimaryButton label={isEdit ? 'Update' : 'Save'} onPress={handleSave} loading={saving} disabled={saving} />
          </View>
        </View>
      </View>
    </Screen>
  );
}
