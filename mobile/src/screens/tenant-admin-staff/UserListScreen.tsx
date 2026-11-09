import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { RowActionButton } from '../../components/RowActionButton';
import { StatusBadge } from '../../components/StatusBadge';
import { SectionLabel } from '../../components/AdminList';
import { AdminFab, AdminPageHeader, AdminSearchBar } from '../../components/AdminPageHeader';
import { avatarTint } from '../../theme/accents';
import { createTypedClient } from '../../api/client';
import { colors, radius, size } from '../../theme/tokens';
import type { TenantAdminStaffStackParamList } from '../../navigation/TenantAdminStaffNavigator';
import type { paths } from '../../api/generated/001-company-role-user-setup';

type Props = NativeStackScreenProps<TenantAdminStaffStackParamList, 'UserList'>;

const client = createTypedClient<paths>();

type TenantUser = {
  id: string;
  name: string;
  username: string;
  role: 'company_staff' | 'student' | 'teaching' | 'non_teaching';
  status: 'active' | 'inactive' | 'locked';
};

/**
 * Company Admin's own-company Users list — company_staff/student/teaching/
 * non_teaching only (company_admin itself was dropped from this screen on
 * explicit request; /tenant/users' own `list` never returns one anyway).
 * Client-side search over the full fetched list, same convention as System
 * Admin's own UserListScreen (no pagination here — not requested for this
 * screen, unlike Products/Departments/Categories). Replaces the old
 * StaffListScreen's inline-create-form + activate/toggle-role UI with the
 * separate list/create-edit-page pattern this task asked for.
 */
export function UserListScreen({ navigation }: Props) {
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    const { data, error } = await client.GET('/tenant/users');
    if (error) {
      setErrorMessage((error as { message?: string })?.message ?? 'Could not load users.');
    } else {
      setUsers((data ?? []).filter((u): u is TenantUser => Boolean(u.id && u.name && u.role)) as TenantUser[]);
    }
    setLoading(false);
  }, []);


  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const query = searchQuery.trim().toLowerCase();
  const filteredUsers = query
    ? users.filter((u) => u.name.toLowerCase().includes(query) || u.username.toLowerCase().includes(query))
    : users;

  async function deleteUser(userId: string) {
    setDeletingId(userId);
    setErrorMessage(null);
    const { error } = await client.DELETE('/tenant/users/{userId}', {
      params: { path: { userId } },
    });
    setDeletingId(null);
    if (error) {
      setErrorMessage((error as { message?: string })?.message ?? 'Could not delete user.');
      return;
    }
    setUsers((prev) => prev.filter((u) => u.id !== userId));
  }

  // Soft delete, not a hard delete (CLAUDE.md's Data Conventions) — the
  // backend blocks this user from logging in from this point on ("blocked
  // contact admin") and revokes any session already in progress.
  function confirmDelete(user: TenantUser) {
    Alert.alert('Delete user?', `This blocks "${user.name}" from logging in. This cannot be undone from here.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteUser(user.id) },
    ]);
  }

  return (
    <Screen
      surface="admin"
      title="Users"
      specRef="UI Design §5.4"
      scroll={false}
      header={
        <AdminPageHeader
          title="Users"
          subtitle="Staff, students and campus users"
          onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.getParent()?.navigate('Dashboard'))}
        >
          <AdminSearchBar>
            <TextInput
              accessibilityLabel="Search by name or username"
              style={{
                height: size.field,
                borderRadius: radius.xl,
                backgroundColor: colors.surface,
                paddingLeft: 44,
                paddingRight: 16,
                color: colors.espresso,
              }}
              className="text-body"
              placeholder="Search by name or username"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </AdminSearchBar>
        </AdminPageHeader>
      }
    >
      {errorMessage ? <Text className="text-body text-red-strong pb-sm">{errorMessage}</Text> : null}

      {loading ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          className="flex-1"
          contentContainerStyle={{ gap: 10, paddingBottom: 110 }}
          data={filteredUsers}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            filteredUsers.length > 0 ? <SectionLabel>{`${filteredUsers.length} users`}</SectionLabel> : null
          }
          ListEmptyComponent={
            <Text className="text-body text-text-secondary text-center mt-8">
              {users.length === 0 ? 'No users yet. Tap Add user to create one.' : 'No users match your search.'}
            </Text>
          }
          renderItem={({ item: user }) => {
            const avatar = avatarTint(user.id);
            return (
              /* One row, per the artboard: circular initial avatar, then name
                 + status pill над username · role, then edit and delete. The
                 actions used to sit on a second line below the row. */
              <View
                style={{ borderRadius: radius['3xl'], borderWidth: 1, borderColor: colors.borderCard }}
                className="flex-row items-center gap-sm bg-surface p-sm"
              >
                <View
                  style={{
                    width: size.touch,
                    height: size.touch,
                    borderRadius: size.touch / 2,
                    backgroundColor: avatar.backgroundColor,
                  }}
                  className="items-center justify-center"
                >
                  <Text style={{ color: avatar.color }} className="text-subtitle-sm">
                    {user.name.trim().charAt(0).toUpperCase()}
                  </Text>
                </View>

                <View className="flex-1 gap-glyph">
                  <View className="flex-row items-center gap-xs">
                    <Text className="flex-1 text-body-bold text-text-primary" numberOfLines={1}>
                      {user.name}
                    </Text>
                    <StatusBadge status={user.status === 'active' ? 'active' : 'inactive'} />
                  </View>
                  <Text className="text-caption text-text-secondary" numberOfLines={1}>
                    {user.username} · {user.role}
                  </Text>
                </View>

                <RowActionButton
                  variant="edit"
                  label={`Edit ${user.name}`}
                  onPress={() => navigation.navigate('UserCreateEdit', { userId: user.id })}
                />
                <RowActionButton
                  variant="delete"
                  label={`Delete ${user.name}`}
                  loading={deletingId === user.id}
                  onPress={() => confirmDelete(user)}
                />
              </View>
            );
          }}
        />
      )}

      <AdminFab label="Add user" onPress={() => navigation.navigate('UserCreateEdit', {})} />
    </Screen>
  );
}
