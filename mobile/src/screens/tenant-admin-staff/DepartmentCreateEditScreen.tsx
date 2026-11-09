import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, radius } from '../../theme/tokens';
import { BottomSheet } from '../../components/BottomSheet';
import { FormField } from '../../components/FormField';
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
    // The sheet itself, empty — a bare Screen here would briefly paint a
    // full-height panel over the list before the sheet took its place.
    return (
      <BottomSheet title="Edit department" icon="departments" onClose={() => navigation.goBack()}>
        <ActivityIndicator />
      </BottomSheet>
    );
  }

  return (
    <BottomSheet
      title={isEdit ? 'Edit department' : 'Add department'}
      icon="departments"
      accent="mint"
      onClose={() => navigation.goBack()}
    >
      <FormField
        tone="sheet"
        label="Department name"
        placeholder="e.g. Computer Science"
        value={name}
        onChangeText={setName}
      />

      {errorMessage ? <Text className="text-body text-red-strong">{errorMessage}</Text> : null}

      {/* Edit shows a single full-width Save; Add shows Cancel + Add at
          flex 1 / flex 2. Both commit in navy — back-of-house. */}
      {isEdit ? (
        <Pressable
          onPress={handleSave}
          disabled={saving}
          accessibilityRole="button"
          style={{
            height: 56,
            borderRadius: radius.pill,
            backgroundColor: colors.primaryVariant,
            opacity: saving ? 0.6 : 1,
          }}
          className="items-center justify-center"
        >
          <Text className="text-price text-surface">Save changes</Text>
        </Pressable>
      ) : (
        <View className="flex-row gap-sm">
          <Pressable
            onPress={() => navigation.goBack()}
            disabled={saving}
            accessibilityRole="button"
            style={{ flex: 1, height: 56, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.borderChip }}
            className="items-center justify-center active:opacity-70"
          >
            <Text className="text-price text-text-primary">Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={saving}
            accessibilityRole="button"
            style={{
              flex: 2,
              height: 56,
              borderRadius: radius.pill,
              backgroundColor: colors.primaryVariant,
              opacity: saving ? 0.6 : 1,
            }}
            className="items-center justify-center"
          >
            <Text className="text-price text-surface">Add department</Text>
          </Pressable>
        </View>
      )}
    </BottomSheet>
  );
}
