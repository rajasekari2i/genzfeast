import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { RowActionButton } from '../../components/RowActionButton';
import { createTypedClient } from '../../api/client';
import { colors } from '../../theme/tokens';
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

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => navigation.navigate('UserCreateEdit', {})} hitSlop={8}>
          <Text style={{ color: colors.surface, fontWeight: '700', fontSize: 15 }}>+ Add</Text>
        </Pressable>
      ),
    });
  }, [navigation]);

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
    <Screen title="Users" specRef="UI Design §5.4">
      <View className="gap-3">
        <TextInput
          className="border border-border rounded-lg px-3 py-2 text-text-primary"
          placeholder="Search by name or username"
          autoCapitalize="none"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        {errorMessage ? <Text className="text-body text-red-600">{errorMessage}</Text> : null}

        {loading ? (
          <ActivityIndicator />
        ) : filteredUsers.length === 0 ? (
          <Text className="text-body text-text-secondary text-center mt-8">
            {users.length === 0 ? 'No users yet. Tap + Add to create one.' : 'No users match your search.'}
          </Text>
        ) : (
          filteredUsers.map((user) => (
            <View key={user.id} className="border border-border rounded-lg p-4 bg-surface">
              <View className="flex-row items-start justify-between gap-2">
                <Text className="text-body-bold text-text-primary flex-1" numberOfLines={1}>
                  {user.name}
                </Text>
                <View className={`rounded-pill px-2 py-0.5 ${user.status === 'active' ? 'bg-secondary' : 'bg-border'}`}>
                  <Text className="text-caption text-surface">{user.status}</Text>
                </View>
              </View>
              <Text className="text-body text-text-secondary mt-1">
                {user.username} · {user.role}
              </Text>
              <View className="flex-row justify-end gap-2 mt-2">
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
            </View>
          ))
        )}
      </View>
    </Screen>
  );
}
