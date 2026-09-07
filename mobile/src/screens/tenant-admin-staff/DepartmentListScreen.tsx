import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { RowActionButton } from '../../components/RowActionButton';
import { createTypedClient } from '../../api/client';
import { colors } from '../../theme/tokens';
import type { TenantAdminStaffStackParamList } from '../../navigation/TenantAdminStaffNavigator';
import type { paths } from '../../api/generated/001-company-role-user-setup';

type Props = NativeStackScreenProps<TenantAdminStaffStackParamList, 'DepartmentList'>;

const client = createTypedClient<paths>();
const PAGE_LIMIT = 10;
const SEARCH_DEBOUNCE_MS = 300;

type Department = { id: string; name: string };

/**
 * Company Admin only (Company Admin/Staff/Student can all read this via
 * /tenant/departments, but only Company Admin gets Add/Edit/Delete —
 * matches CompanyListScreen/UserListScreen/ProductListScreen's own
 * pattern). Server-side pagination (10 per page, fetch the next page on
 * scroll) with a name search filter — rewritten from the earlier
 * inline-rename-form version once this task asked for a separate create/
 * edit page with real pagination.
 */
export function DepartmentListScreen({ navigation }: Props) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const pageRef = useRef(1);
  const searchRef = useRef('');

  const loadPage = useCallback(async (page: number, search: string, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setErrorMessage(null);

    const { data, error } = await client.GET('/tenant/departments', {
      params: { query: { page, limit: PAGE_LIMIT, ...(search && { search }) } },
    });
    if (error) {
      setErrorMessage((error as { message?: string })?.message ?? 'Could not load departments.');
    } else if (data) {
      const items = (data.items ?? []).filter((d): d is Department => Boolean(d.id && d.name)) as Department[];
      setDepartments((prev) => (append ? [...prev, ...items] : items));
      setHasMore(page * (data.limit ?? PAGE_LIMIT) < (data.total ?? 0));
      pageRef.current = page;
    }
    if (append) setLoadingMore(false);
    else setLoading(false);
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => navigation.navigate('DepartmentCreateEdit', {})} hitSlop={8}>
          <Text style={{ color: colors.surface, fontWeight: '700', fontSize: 15 }}>+ Add</Text>
        </Pressable>
      ),
    });
  }, [navigation]);

  useEffect(() => {
    const handle = setTimeout(() => {
      searchRef.current = searchQuery.trim();
      loadPage(1, searchRef.current, false);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchQuery, loadPage]);

  useFocusEffect(
    useCallback(() => {
      loadPage(1, searchRef.current, false);
    }, [loadPage]),
  );

  function handleEndReached() {
    if (!hasMore || loadingMore || loading) return;
    loadPage(pageRef.current + 1, searchRef.current, true);
  }

  async function deleteDepartment(departmentId: string) {
    setDeletingId(departmentId);
    setErrorMessage(null);
    const { error } = await client.DELETE('/tenant/departments/{departmentId}', {
      params: { path: { departmentId } },
    });
    setDeletingId(null);
    if (error) {
      setErrorMessage((error as { message?: string })?.message ?? 'Could not delete department.');
      return;
    }
    setDepartments((prev) => prev.filter((d) => d.id !== departmentId));
  }

  function confirmDelete(department: Department) {
    Alert.alert('Delete department?', `Remove "${department.name}"? This cannot be undone from here.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteDepartment(department.id) },
    ]);
  }

  return (
    <Screen title="Departments" specRef="UI Design §5.4" scroll={false}>
      <View className="gap-3 mb-3">
        <TextInput
          className="border border-border rounded-lg px-3 py-2 text-text-primary"
          placeholder="Search by name"
          autoCapitalize="none"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        {errorMessage ? <Text className="text-body text-red-600">{errorMessage}</Text> : null}
      </View>

      {loading ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          className="flex-1"
          data={departments}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <Text className="text-body text-text-secondary text-center mt-8">
              {searchQuery ? 'No departments match your search.' : 'No departments yet. Tap + Add to create one.'}
            </Text>
          }
          onEndReachedThreshold={0.5}
          onEndReached={handleEndReached}
          ListFooterComponent={loadingMore ? <ActivityIndicator className="my-3" /> : null}
          renderItem={({ item: department }) => (
            <View className="flex-row items-center justify-between gap-2 border-b border-border py-3">
              <Text className="flex-1 text-body-bold text-text-primary" numberOfLines={1}>
                {department.name}
              </Text>
              <View className="flex-row gap-2">
                <RowActionButton
                  variant="edit"
                  label={`Edit ${department.name}`}
                  onPress={() => navigation.navigate('DepartmentCreateEdit', { departmentId: department.id })}
                />
                <RowActionButton
                  variant="delete"
                  label={`Delete ${department.name}`}
                  loading={deletingId === department.id}
                  onPress={() => confirmDelete(department)}
                />
              </View>
            </View>
          )}
        />
      )}
    </Screen>
  );
}
