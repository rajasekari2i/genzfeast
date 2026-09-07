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

type Props = NativeStackScreenProps<TenantAdminStaffStackParamList, 'CategoryList'>;

const client = createTypedClient<paths>();
const PAGE_LIMIT = 10;
const SEARCH_DEBOUNCE_MS = 300;

type Category = { id: string; name: string };

/**
 * The registrant-affiliation Category (Student/Teaching Staff/Non-Teaching
 * Staff — the dropdown value collected at registration and shown on this
 * task's own company_admin Users screen for a student). NOT a food/product
 * classification (docs/product/01-BRD.md, UI-Design §5.3's own Product
 * field list has no category at all) — see CLAUDE.md's "Category vs
 * Department vs Role" note. Company Admin only. Server-side pagination (10
 * per page, fetch the next page on scroll) with a name search filter —
 * rewritten from the earlier inline-rename-form version to match
 * DepartmentListScreen/ProductListScreen's own pattern.
 */
export function CategoryListScreen({ navigation }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
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

    const { data, error } = await client.GET('/tenant/categories', {
      params: { query: { page, limit: PAGE_LIMIT, ...(search && { search }) } },
    });
    if (error) {
      setErrorMessage((error as { message?: string })?.message ?? 'Could not load categories.');
    } else if (data) {
      const items = (data.items ?? []).filter((c): c is Category => Boolean(c.id && c.name)) as Category[];
      setCategories((prev) => (append ? [...prev, ...items] : items));
      setHasMore(page * (data.limit ?? PAGE_LIMIT) < (data.total ?? 0));
      pageRef.current = page;
    }
    if (append) setLoadingMore(false);
    else setLoading(false);
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => navigation.navigate('CategoryCreateEdit', {})} hitSlop={8}>
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

  async function deleteCategory(categoryId: string) {
    setDeletingId(categoryId);
    setErrorMessage(null);
    const { error } = await client.DELETE('/tenant/categories/{categoryId}', {
      params: { path: { categoryId } },
    });
    setDeletingId(null);
    if (error) {
      setErrorMessage((error as { message?: string })?.message ?? 'Could not delete category.');
      return;
    }
    setCategories((prev) => prev.filter((c) => c.id !== categoryId));
  }

  function confirmDelete(category: Category) {
    Alert.alert('Delete category?', `Remove "${category.name}"? This cannot be undone from here.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteCategory(category.id) },
    ]);
  }

  return (
    <Screen title="Categories" specRef="UI Design §5.4" scroll={false}>
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
          data={categories}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <Text className="text-body text-text-secondary text-center mt-8">
              {searchQuery ? 'No categories match your search.' : 'No categories yet. Tap + Add to create one.'}
            </Text>
          }
          onEndReachedThreshold={0.5}
          onEndReached={handleEndReached}
          ListFooterComponent={loadingMore ? <ActivityIndicator className="my-3" /> : null}
          renderItem={({ item: category }) => (
            <View className="flex-row items-center justify-between gap-2 border-b border-border py-3">
              <Text className="flex-1 text-body-bold text-text-primary" numberOfLines={1}>
                {category.name}
              </Text>
              <View className="flex-row gap-2">
                <RowActionButton
                  variant="edit"
                  label={`Edit ${category.name}`}
                  onPress={() => navigation.navigate('CategoryCreateEdit', { categoryId: category.id })}
                />
                <RowActionButton
                  variant="delete"
                  label={`Delete ${category.name}`}
                  loading={deletingId === category.id}
                  onPress={() => confirmDelete(category)}
                />
              </View>
            </View>
          )}
        />
      )}
    </Screen>
  );
}
