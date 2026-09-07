import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { createTypedClient } from '../../api/client';
import type { SystemAdminStackParamList } from '../../navigation/SystemAdminNavigator';
import type { paths } from '../../api/generated/001-company-role-user-setup';

type Props = NativeStackScreenProps<SystemAdminStackParamList, 'CompanyCreateEdit'>;

const client = createTypedClient<paths>();

/**
 * UI Design §6.2 — Name, Contact Person, Mobile, Email, Address. No
 * GET-by-id endpoint exists for a single company (only list/create/update),
 * so edit mode re-fetches the list and finds the matching row — the same
 * pattern ProductCreateEditScreen already uses for products.
 */
export function CompanyCreateEditScreen({ route, navigation }: Props) {
  const { companyId } = route.params;
  const isEdit = Boolean(companyId);

  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const { data, error } = await client.GET('/admin/companies');
      if (!error && data) {
        const existing = data.find((c) => c.id === companyId);
        if (existing) {
          setName(existing.name ?? '');
          setContactPerson(existing.contact_person ?? '');
          setMobile(existing.mobile ?? '');
          setEmail(existing.email ?? '');
          setAddress(existing.address ?? '');
        }
      }
      setLoading(false);
    })();
  }, [companyId]);

  async function handleSave() {
    const missing = [
      !name.trim() && 'Name',
      !contactPerson.trim() && 'Contact Person',
      !mobile.trim() && 'Mobile',
      !email.trim() && 'Email',
      !address.trim() && 'Address',
    ].filter((field): field is string => Boolean(field));
    if (missing.length > 0) {
      setErrorMessage(`Missing: ${missing.join(', ')}.`);
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    const body = {
      name: name.trim(),
      contact_person: contactPerson.trim(),
      mobile: mobile.trim(),
      email: email.trim(),
      address: address.trim(),
    };
    const { error } = companyId
      ? await client.PATCH('/admin/companies/{companyId}', { params: { path: { companyId } }, body })
      : await client.POST('/admin/companies', { body });

    if (error) {
      setErrorMessage((error as { message?: string })?.message ?? 'Could not save company.');
      setSaving(false);
      return;
    }

    navigation.goBack();
  }

  if (loading) {
    return <Screen title="Edit Company" specRef="UI Design §6.2" />;
  }

  return (
    <Screen title={isEdit ? 'Edit Company' : 'Create Company'} specRef="UI Design §6.2">
      <View className="gap-3">
        <TextInput
          className="border border-border rounded-lg px-3 py-2 text-text-primary"
          placeholder="Name"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          className="border border-border rounded-lg px-3 py-2 text-text-primary"
          placeholder="Contact Person"
          value={contactPerson}
          onChangeText={setContactPerson}
        />
        <TextInput
          className="border border-border rounded-lg px-3 py-2 text-text-primary"
          placeholder="Mobile"
          keyboardType="phone-pad"
          value={mobile}
          onChangeText={setMobile}
        />
        <TextInput
          className="border border-border rounded-lg px-3 py-2 text-text-primary"
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          className="border border-border rounded-lg px-3 py-2 text-text-primary"
          style={{ minHeight: 90, textAlignVertical: 'top' }}
          placeholder="Address"
          multiline
          numberOfLines={4}
          value={address}
          onChangeText={setAddress}
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
