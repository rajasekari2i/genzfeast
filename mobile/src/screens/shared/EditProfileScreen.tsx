import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { CategoryChip } from '../../components/CategoryChip';
import { createTypedClient } from '../../api/client';
import type { ProfileStackParamList } from '../../navigation/ProfileNavigator';
import type { paths as ProfilePaths } from '../../api/generated/007-user-profile-management';
import type { paths as DepartmentsPaths } from '../../api/generated/001-company-role-user-setup';

type Props = NativeStackScreenProps<ProfileStackParamList, 'EditProfile'>;

const profileClient = createTypedClient<ProfilePaths>();
const departmentsClient = createTypedClient<DepartmentsPaths>();

type DepartmentOption = { id: string; name: string };

/**
 * UI Design §4.11 — Name/Username shown for context only (never editable,
 * FR-003/FR-008); Email always editable; Department editable for a Student
 * only (fetched from GET /tenant/departments — the same endpoint's
 * `student` read access already covers this caller, specs/001).
 */
export function EditProfileScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [isStudent, setIsStudent] = useState(false);
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await profileClient.GET('/me/profile', {});
      if (!error && data) {
        setName(data.name ?? '');
        setUsername(data.username ?? '');
        setEmail(data.email ?? '');
        const studentAccount = data.category !== undefined;
        setIsStudent(studentAccount);

        if (studentAccount) {
          // /tenant/departments is server-side paginated (10 per page) —
          // this dropdown needs every department to find the student's own
          // by name, so it requests the max page size (50) instead of
          // paging through results. A company with more than 50 departments
          // isn't handled here (an edge case well beyond any real college).
          const deptResult = await departmentsClient.GET('/tenant/departments', {
            params: { query: { limit: 50 } },
          });
          if (!deptResult.error && deptResult.data?.items) {
            const items = deptResult.data.items;
            setDepartments(
              items.filter((d): d is DepartmentOption => Boolean(d.id && d.name)) as DepartmentOption[],
            );
            const current = items.find((d) => d.name === data.department);
            setDepartmentId(current?.id ?? null);
          }
        }
      }
      setLoading(false);
    })();
  }, []);

  async function handleSave() {
    setSaving(true);
    setErrorMessage(null);
    const { error } = await profileClient.PATCH('/me/profile', {
      body: {
        email: email.trim(),
        ...(isStudent && departmentId ? { department_id: departmentId } : {}),
      },
    });
    setSaving(false);

    if (error) {
      setErrorMessage((error as { message?: string })?.message ?? 'Could not save. Please check your details.');
      return;
    }

    Alert.alert('Profile updated');
    navigation.goBack();
  }

  if (loading) {
    return <Screen title="Edit Profile" specRef="UI Design §4.11" />;
  }

  return (
    <Screen title="Edit Profile" specRef="UI Design §4.11">
      <View className="gap-3">
        <Text className="text-caption text-text-secondary">Name (read-only)</Text>
        <TextInput className="border border-border rounded-lg px-3 py-2 text-text-secondary" value={name} editable={false} />

        <Text className="text-caption text-text-secondary">Username (read-only)</Text>
        <TextInput
          className="border border-border rounded-lg px-3 py-2 text-text-secondary"
          value={username}
          editable={false}
        />

        <Text className="text-caption text-text-secondary">Email</Text>
        <TextInput
          className="border border-border rounded-lg px-3 py-2 text-text-primary"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        {isStudent ? (
          <>
            <Text className="text-caption text-text-secondary">Department</Text>
            {departments.length === 0 ? (
              <ActivityIndicator />
            ) : (
              <View className="flex-row flex-wrap">
                {departments.map((d) => (
                  <CategoryChip key={d.id} label={d.name} selected={departmentId === d.id} onPress={() => setDepartmentId(d.id)} />
                ))}
              </View>
            )}
          </>
        ) : null}

        {errorMessage ? <Text className="text-body text-red-600">{errorMessage}</Text> : null}
        <PrimaryButton label="Save" onPress={handleSave} loading={saving} disabled={saving} />
      </View>
    </Screen>
  );
}
