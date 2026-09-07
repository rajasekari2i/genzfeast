import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { Dropdown } from '../../components/Dropdown';
import { createTypedClient } from '../../api/client';
import type { TenantAdminStaffStackParamList } from '../../navigation/TenantAdminStaffNavigator';
import type { paths } from '../../api/generated/001-company-role-user-setup';

type Props = NativeStackScreenProps<TenantAdminStaffStackParamList, 'UserCreateEdit'>;

const client = createTypedClient<paths>();

const GENDER_OPTIONS = [
  { label: 'Male', value: 'male' as const },
  { label: 'Female', value: 'female' as const },
  { label: 'Transgender', value: 'transgender' as const },
];

const ROLE_OPTIONS = [
  { label: 'Company Staff', value: 'company_staff' as const },
  { label: 'Student', value: 'student' as const },
  { label: 'Teaching', value: 'teaching' as const },
  { label: 'Non-Teaching', value: 'non_teaching' as const },
];

type Role = 'company_staff' | 'student' | 'teaching' | 'non_teaching';

/**
 * Company Admin's own-company "Create/Edit User" — company_staff/student/
 * teaching/non_teaching only (company_admin dropped from this screen on
 * explicit request). No GET-by-id endpoint for a single tenant user (only
 * list/create/update/delete, and the list itself isn't paginated — unlike
 * Products/Departments/Categories), so edit mode re-fetches the list and
 * finds the matching row, same as CompanyCreateEditScreen's own pattern.
 * Category (required) + Department (optional) only show when role is
 * 'student', mirroring RegisterScreen's own requirement.
 */
export function UserCreateEditScreen({ route, navigation }: Props) {
  const { userId } = route.params ?? {};
  const isEdit = Boolean(userId);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'transgender' | undefined>(undefined);
  const [role, setRole] = useState<Role | undefined>(undefined);
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [departmentId, setDepartmentId] = useState<string | undefined>(undefined);
  const [categories, setCategories] = useState<{ label: string; value: string }[]>([]);
  const [departments, setDepartments] = useState<{ label: string; value: string }[]>([]);
  const [loadingUser, setLoadingUser] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      // /tenant/categories and /tenant/departments are both server-side
      // paginated (10 per page) — these dropdowns need every row, so they
      // request the max page size (50) instead of paging through results.
      const [categoriesResult, departmentsResult] = await Promise.all([
        client.GET('/tenant/categories', { params: { query: { limit: 50 } } }),
        client.GET('/tenant/departments', { params: { query: { limit: 50 } } }),
      ]);
      if (categoriesResult.data?.items) {
        setCategories(
          categoriesResult.data.items
            .filter((c): c is { id: string; name: string } => Boolean(c.id && c.name))
            .map((c) => ({ label: c.name, value: c.id })),
        );
      }
      if (departmentsResult.data?.items) {
        setDepartments(
          departmentsResult.data.items
            .filter((d): d is { id: string; name: string } => Boolean(d.id && d.name))
            .map((d) => ({ label: d.name, value: d.id })),
        );
      }
    })();
  }, []);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data, error } = await client.GET('/tenant/users');
      if (!error && data) {
        const existing = data.find((u) => u.id === userId);
        if (existing) {
          setName(existing.name ?? '');
          setUsername(existing.username ?? '');
          setEmail(existing.email ?? '');
          setGender(existing.gender as 'male' | 'female' | 'transgender' | undefined);
          setRole(existing.role as Role | undefined);
          setCategoryId(existing.category_id ?? undefined);
          setDepartmentId(existing.department_id ?? undefined);
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
      role === 'student' && !categoryId && 'Category',
    ].filter((field): field is string => Boolean(field));
    if (missing.length > 0) {
      setErrorMessage(`Missing: ${missing.join(', ')}.`);
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    const { error } = userId
      ? await client.PATCH('/tenant/users/{userId}', {
          params: { path: { userId } },
          body: {
            name: name.trim(),
            username: username.trim(),
            ...(password.length > 0 && { password }),
            email: email.trim(),
            gender: gender as 'male' | 'female' | 'transgender',
            role: role as Role,
            ...(role === 'student' && { category_id: categoryId, department_id: departmentId }),
          },
        })
      : await client.POST('/tenant/users', {
          body: {
            name: name.trim(),
            username: username.trim(),
            password,
            email: email.trim(),
            gender: gender as 'male' | 'female' | 'transgender',
            role: role as Role,
            ...(role === 'student' && { category_id: categoryId, department_id: departmentId }),
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
    return <Screen title="Edit User" specRef="UI Design §5.4" />;
  }

  return (
    <Screen title={isEdit ? 'Edit User' : 'Create User'} specRef="UI Design §5.4">
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
        {role === 'student' ? (
          <>
            <Dropdown
              label="Category"
              value={categoryId}
              options={categories}
              onChange={setCategoryId}
              placeholder="Select Category"
            />
            <Dropdown
              label="Department (optional)"
              value={departmentId}
              options={departments}
              onChange={setDepartmentId}
              placeholder="Select Department"
            />
          </>
        ) : null}

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
