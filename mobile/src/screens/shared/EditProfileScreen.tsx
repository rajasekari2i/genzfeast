import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Icon } from '../../components/Icon';
import { InfoCard, InfoRow } from '../../components/InfoCard';
import { colors } from '../../theme/tokens';
import { FormField } from '../../components/FormField';
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
    // The server's UpdateProfileDto enforces MinLength(1) on name; checking
    // here too turns a 400 into an inline message instead of a generic
    // failure alert.
    if (!name.trim()) {
      setErrorMessage('Name cannot be empty.');
      return;
    }
    setSaving(true);
    setErrorMessage(null);
    const { error } = await profileClient.PATCH('/me/profile', {
      body: {
        name: name.trim(),
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
    <Screen title="Edit Profile" scroll={false}>
      <View className="flex-1 gap-md">
        {/* No artboard for this screen (FR-029), so it borrows ProfileScreen's
            language wholesale: the same 44px back control, the same Bricolage
            title, and the same espresso action pill — here Save rather than
            Edit. Shared across every role, since ProfileNavigator is mounted
            once in AppShell for all of them. */}
        <View className="flex-row items-center gap-sm">
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={{ borderWidth: 1, borderColor: colors.borderSoft }}
            className="w-touch h-touch rounded-pill bg-surface items-center justify-center"
          >
            <Icon name="chevronLeft" size={20} color={colors.espresso} />
          </Pressable>
          <Text className="flex-1 text-title text-text-primary">Edit profile</Text>
          <Pressable
            onPress={handleSave}
            disabled={saving}
            accessibilityRole="button"
            accessibilityState={{ disabled: saving }}
            style={{ opacity: saving ? 0.6 : 1 }}
            className="h-touch px-md bg-espresso rounded-pill flex-row items-center gap-xs"
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.surface} />
            ) : (
              <Icon name="check" size={16} color={colors.surface} />
            )}
            <Text className="text-label-bold text-surface">Save</Text>
          </Pressable>
        </View>

        {/* Name and Username are permanently read-only (FR-030). Profile
            presents unchangeable values as LIST ROWS with a lock on the
            label, not as disabled inputs — a disabled text box invites a tap
            that does nothing. Same treatment here. */}
        {/* Username alone is permanently read-only (FR-005): it is the login
            identifier and is unique per tenant, so changing it would need a
            uniqueness check and a session story /me/profile does not have.
            Name IS editable for every role — the endpoint accepts it. */}
        <InfoCard>
          <InfoRow label="Username" noteIcon="lock" value={username || '—'} last />
        </InfoCard>

        <View className="gap-md">
          <FormField label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
          <FormField
            label="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          {isStudent ? (
            <View className="gap-sm">
              <Text className="text-label text-text-body">Department</Text>
              {departments.length === 0 ? (
                <ActivityIndicator />
              ) : (
                <View className="flex-row flex-wrap">
                  {departments.map((d) => (
                    <CategoryChip
                      key={d.id}
                      label={d.name}
                      selected={departmentId === d.id}
                      onPress={() => setDepartmentId(d.id)}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : null}

          {errorMessage ? <Text className="text-body text-red-strong">{errorMessage}</Text> : null}
        </View>
      </View>
    </Screen>
  );
}
