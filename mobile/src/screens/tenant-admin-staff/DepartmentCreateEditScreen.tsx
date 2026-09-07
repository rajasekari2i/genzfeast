import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { createTypedClient } from '../../api/client';
import type { TenantAdminStaffStackParamList } from '../../navigation/TenantAdminStaffNavigator';
import type { paths } from '../../api/generated/001-company-role-user-setup';

type Props = NativeStackScreenProps<TenantAdminStaffStackParamList, 'DepartmentCreateEdit'>;

const client = createTypedClient<paths>();

/**
 * Company Admin only. Mirrors CompanyCreateEditScreen/ProductCreateEditScreen's
 * own pattern: fetches by id via the dedicated GET-by-id endpoint (needed
 * since /tenant/departments' own list is paginated), Cancel(left)/
 * Save-or-Update(right) row.
 */
export function DepartmentCreateEditScreen({ route, navigation }: Props) {
  const { departmentId } = route.params ?? {};
  const isEdit = Boolean(departmentId);

  const [name, setName] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!departmentId) return;
    (async () => {
      const { data, error } = await client.GET('/tenant/departments/{departmentId}', {
        params: { path: { departmentId } },
      });
      if (!error && data) {
        setName(data.name ?? '');
      }
      setLoading(false);
    })();
  }, [departmentId]);

  async function handleSave() {
    if (!name.trim()) {
      setErrorMessage('Missing: Name.');
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    const body = { name: name.trim() };
    const { error } = departmentId
      ? await client.PATCH('/tenant/departments/{departmentId}', { params: { path: { departmentId } }, body })
      : await client.POST('/tenant/departments', { body });

    if (error) {
      setErrorMessage((error as { message?: string })?.message ?? 'Could not save department.');
      setSaving(false);
      return;
    }

    navigation.goBack();
  }

  if (loading) {
    return <Screen title="Edit Department" specRef="UI Design §5.4" />;
  }

  return (
    <Screen title={isEdit ? 'Edit Department' : 'Add Department'} specRef="UI Design §5.4">
      <View className="gap-3">
        <TextInput
          className="border border-border rounded-lg px-3 py-2 text-text-primary"
          placeholder="Name"
          value={name}
          onChangeText={setName}
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
