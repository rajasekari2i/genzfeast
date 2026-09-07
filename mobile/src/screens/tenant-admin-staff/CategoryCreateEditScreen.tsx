import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { createTypedClient } from '../../api/client';
import type { TenantAdminStaffStackParamList } from '../../navigation/TenantAdminStaffNavigator';
import type { paths } from '../../api/generated/001-company-role-user-setup';

type Props = NativeStackScreenProps<TenantAdminStaffStackParamList, 'CategoryCreateEdit'>;

const client = createTypedClient<paths>();

/**
 * Company Admin only. Mirrors DepartmentCreateEditScreen's own pattern:
 * fetches by id via the dedicated GET-by-id endpoint (needed since
 * /tenant/categories' own list is paginated), Cancel(left)/
 * Save-or-Update(right) row.
 */
export function CategoryCreateEditScreen({ route, navigation }: Props) {
  const { categoryId } = route.params ?? {};
  const isEdit = Boolean(categoryId);

  const [name, setName] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!categoryId) return;
    (async () => {
      const { data, error } = await client.GET('/tenant/categories/{categoryId}', {
        params: { path: { categoryId } },
      });
      if (!error && data) {
        setName(data.name ?? '');
      }
      setLoading(false);
    })();
  }, [categoryId]);

  async function handleSave() {
    if (!name.trim()) {
      setErrorMessage('Missing: Name.');
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    const body = { name: name.trim() };
    const { error } = categoryId
      ? await client.PATCH('/tenant/categories/{categoryId}', { params: { path: { categoryId } }, body })
      : await client.POST('/tenant/categories', { body });

    if (error) {
      setErrorMessage((error as { message?: string })?.message ?? 'Could not save category.');
      setSaving(false);
      return;
    }

    navigation.goBack();
  }

  if (loading) {
    return <Screen title="Edit Category" specRef="UI Design §5.4" />;
  }

  return (
    <Screen title={isEdit ? 'Edit Category' : 'Add Category'} specRef="UI Design §5.4">
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
