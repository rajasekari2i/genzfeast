import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { RowActionButton } from '../../components/RowActionButton';
import { createTypedClient } from '../../api/client';
import type { SystemAdminStackParamList } from '../../navigation/SystemAdminNavigator';
import type { paths } from '../../api/generated/001-company-role-user-setup';

type Props = NativeStackScreenProps<SystemAdminStackParamList, 'CompanyList'>;

const client = createTypedClient<paths>();

type Company = {
  id: string;
  name: string;
  contact_person: string;
  mobile: string;
  email: string;
  is_open: boolean;
};

/**
 * UI Design §6.1 — name, contact person, mobile, is_open status, actions
 * (specs/001). Refetches on every focus (not just mount) — required so
 * returning here after Save on CompanyCreateEditScreen shows the new/
 * updated row immediately, per this task's own explicit ask, not just the
 * once-on-mount pattern ProductListScreen uses.
 */
export function CompanyListScreen({ navigation }: Props) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    const { data, error } = await client.GET('/admin/companies');
    if (error) {
      setErrorMessage((error as { message?: string })?.message ?? 'Could not load companies.');
    } else {
      setCompanies((data ?? []).filter((c): c is Company => Boolean(c.id && c.name)) as Company[]);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function deleteCompany(companyId: string): Promise<void> {
    setDeletingId(companyId);
    setErrorMessage(null);
    const { error } = await client.DELETE('/admin/companies/{companyId}', {
      params: { path: { companyId } },
    });
    setDeletingId(null);
    if (error) {
      setErrorMessage((error as { message?: string })?.message ?? 'Could not delete company.');
      return;
    }
    setCompanies((prev) => prev.filter((c) => c.id !== companyId));
  }

  // Soft delete, not a hard delete (CLAUDE.md's Data Conventions) — the
  // backend blocks every one of this company's users, in every role, from
  // logging in from this point on ("blocked contact admin").
  function confirmDeleteCompany(company: Company): void {
    Alert.alert(
      'Delete company?',
      `This blocks every user of "${company.name}" from logging in. This cannot be undone from here.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteCompany(company.id) },
      ],
    );
  }

  // Client-side — the full list is already fetched (platform-scale, not
  // paginated), so filtering it locally avoids a round-trip per keystroke.
  const query = searchQuery.trim().toLowerCase();
  const filteredCompanies = query
    ? companies.filter((c) => c.name.toLowerCase().includes(query) || c.mobile.toLowerCase().includes(query))
    : companies;

  return (
    <Screen title="Companies" specRef="UI Design §6.1">
      <View className="gap-3">
        <TextInput
          className="border border-border rounded-lg px-3 py-2 text-text-primary"
          placeholder="Search by name or mobile number"
          autoCapitalize="none"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        {errorMessage ? <Text className="text-body text-red-600">{errorMessage}</Text> : null}

        {loading ? (
          <ActivityIndicator />
        ) : filteredCompanies.length === 0 ? (
          <Text className="text-body text-text-secondary text-center mt-8">
            {companies.length === 0 ? 'No companies yet. Tap + Add to create one.' : 'No companies match your search.'}
          </Text>
        ) : (
          filteredCompanies.map((company) => (
            <Pressable
              key={company.id}
              className="border border-border rounded-lg p-4 bg-surface"
              onPress={() => navigation.navigate('CompanyCreateEdit', { companyId: company.id })}
            >
              <View className="flex-row items-start justify-between gap-2">
                <Text className="text-body-bold text-text-primary flex-1" numberOfLines={1}>
                  {company.name}
                </Text>
                <View className={`rounded-pill px-2 py-0.5 ${company.is_open ? 'bg-secondary' : 'bg-border'}`}>
                  <Text className="text-caption text-surface">{company.is_open ? 'Open' : 'Closed'}</Text>
                </View>
              </View>
              <Text className="text-body text-text-secondary mt-1">
                {company.contact_person} · {company.mobile}
              </Text>
              <Text className="text-caption text-text-secondary mt-0.5">{company.email}</Text>
              <View className="flex-row justify-end gap-2 mt-2">
                <RowActionButton
                  variant="edit"
                  label={`Edit ${company.name}`}
                  onPress={(e) => {
                    e.stopPropagation();
                    navigation.navigate('CompanyCreateEdit', { companyId: company.id });
                  }}
                />
                <RowActionButton
                  variant="delete"
                  label={`Delete ${company.name}`}
                  loading={deletingId === company.id}
                  onPress={(e) => {
                    e.stopPropagation();
                    confirmDeleteCompany(company);
                  }}
                />
              </View>
            </Pressable>
          ))
        )}
      </View>
    </Screen>
  );
}
