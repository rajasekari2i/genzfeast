import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, radius } from '../../theme/tokens';
import { BottomSheet } from '../../components/BottomSheet';
import { FormField } from '../../components/FormField';
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
    // The sheet itself, empty — a bare Screen here would briefly paint a
    // full-height panel over the list before the sheet took its place.
    return (
      <BottomSheet title="Edit category" icon="categories" onClose={() => navigation.goBack()}>
        <ActivityIndicator />
      </BottomSheet>
    );
  }

  return (
    <BottomSheet
      title={isEdit ? 'Edit category' : 'Add category'}
      icon="categories"
      accent="violet"
      onClose={() => navigation.goBack()}
    >
      <FormField
        tone="sheet"
        label="Category name"
        placeholder="e.g. Teaching Staff"
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
            <Text className="text-price text-surface">Add category</Text>
          </Pressable>
        </View>
      )}
    </BottomSheet>
  );
}
