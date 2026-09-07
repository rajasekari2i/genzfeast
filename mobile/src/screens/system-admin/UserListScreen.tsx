import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { RowActionButton } from '../../components/RowActionButton';
import { createTypedClient } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import type { SystemAdminStackParamList } from '../../navigation/SystemAdminNavigator';
import type { paths } from '../../api/generated/001-company-role-user-setup';

type Props = NativeStackScreenProps<SystemAdminStackParamList, 'UserList'>;

const client = createTypedClient<paths>();

type PlatformUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: 'system_admin' | 'company_admin' | 'company_staff' | 'student' | 'teaching' | 'non_teaching';
  status: 'active' | 'inactive' | 'locked';
  company_id: string | null;
};

/**
 * System Admin's cross-tenant Users list — every user, every company.
 * Refetches on every focus (not just mount), matching CompanyListScreen's
 * own pattern, so returning here after Save on UserCreateEditScreen shows
 * the new/updated row immediately. Also fetches Companies alongside Users purely to
 * resolve company_id -> name for display and for the company-name search
 * field — UserResponse itself only carries the id.
 */
const EDITABLE_ROLES: PlatformUser['role'][] = ['company_staff', 'company_admin'];

export function UserListScreen({ navigation }: Props) {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [companyNamesById, setCompanyNamesById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    const [usersResult, companiesResult] = await Promise.all([client.GET('/admin/users'), client.GET('/admin/companies')]);
    if (usersResult.error) {
      setErrorMessage((usersResult.error as { message?: string })?.message ?? 'Could not load users.');
    } else {
      setUsers(
        (usersResult.data ?? []).filter((u): u is PlatformUser => Boolean(u.id && u.name && u.role)) as PlatformUser[],
      );
    }
    if (companiesResult.data) {
      const map: Record<string, string> = {};
      for (const c of companiesResult.data) {
        if (c.id && c.name) map[c.id] = c.name;
      }
      setCompanyNamesById(map);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function deleteUser(userId: string): Promise<void> {
    setDeletingId(userId);
    setErrorMessage(null);
    const { error } = await client.DELETE('/admin/users/{userId}', {
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
  function confirmDeleteUser(targetUser: PlatformUser): void {
    Alert.alert(
      'Delete user?',
      `This blocks "${targetUser.name}" from logging in. This cannot be undone from here.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteUser(targetUser.id) },
      ],
    );
  }

  // Client-side — the full list is already fetched (platform-scale, not
  // paginated), so filtering it locally avoids a round-trip per keystroke.
  const query = searchQuery.trim().toLowerCase();
  const filteredUsers = query
    ? users.filter((u) => {
        const companyName = u.company_id ? companyNamesById[u.company_id] ?? '' : '';
        return (
          u.name.toLowerCase().includes(query) ||
          u.username.toLowerCase().includes(query) ||
          companyName.toLowerCase().includes(query)
        );
      })
    : users;

  return (
    <Screen title="Users" specRef="UI Design §6">
      <View className="gap-3">
        <TextInput
          className="border border-border rounded-lg px-3 py-2 text-text-primary"
          placeholder="Search by company, name, or username"
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
              <Text className="text-caption text-text-secondary mt-0.5">
                {user.company_id ? companyNamesById[user.company_id] ?? 'Unknown company' : 'Platform-wide'} · {user.email}
              </Text>
              {(EDITABLE_ROLES.includes(user.role) || user.id !== currentUser?.id) && (
                <View className="flex-row justify-end gap-2 mt-2">
                  {EDITABLE_ROLES.includes(user.role) && (
                    <RowActionButton
                      variant="edit"
                      label={`Edit ${user.name}`}
                      onPress={() => navigation.navigate('UserCreate', { userId: user.id })}
                    />
                  )}
                  {user.id !== currentUser?.id && (
                    <RowActionButton
                      variant="delete"
                      label={`Delete ${user.name}`}
                      loading={deletingId === user.id}
                      onPress={() => confirmDeleteUser(user)}
                    />
                  )}
                </View>
              )}
            </View>
          ))
        )}
      </View>
    </Screen>
  );
}
