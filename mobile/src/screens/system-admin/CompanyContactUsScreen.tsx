import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { createTypedClient } from '../../api/client';
import type { SystemAdminStackParamList } from '../../navigation/SystemAdminNavigator';
import type { paths } from '../../api/generated/001-company-role-user-setup';

type Props = NativeStackScreenProps<SystemAdminStackParamList, 'CompanyContactUs'>;

const client = createTypedClient<paths>();

/**
 * specs/015-contact-us-page User Story 2 — System Admin's dedicated Contact
 * Us management screen, distinct from CompanyCreateEditScreen (FR-003):
 * Contact Person, Phone Number, Email, Address, Operating Hours only — not
 * Name/is_open/is_sms, which stay on the onboarding/edit screen. No
 * GET-by-id endpoint exists for a single company, so this re-fetches the
 * list and finds the matching row, the same pattern CompanyCreateEditScreen
 * already uses.
 */
export function CompanyContactUsScreen({ route, navigation }: Props) {
  const { companyId } = route.params;

  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [operatingHours, setOperatingHours] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await client.GET('/admin/companies');
      if (!error && data) {
        const existing = data.find((c) => c.id === companyId);
        if (existing) {
          setCompanyName(existing.name ?? '');
          setContactPerson(existing.contact_person ?? '');
          setMobile(existing.mobile ?? '');
          setEmail(existing.email ?? '');
          setAddress(existing.address ?? '');
          setOperatingHours(existing.operating_hours ?? '');
        }
      }
      setLoading(false);
    })();
  }, [companyId]);

  async function handleSave() {
    const missing = [
      !contactPerson.trim() && 'Contact Person',
      !mobile.trim() && 'Phone Number',
      !email.trim() && 'Email',
      !address.trim() && 'Address',
    ].filter((field): field is string => Boolean(field));
    if (missing.length > 0) {
      setErrorMessage(`Missing: ${missing.join(', ')}.`);
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    // All-or-nothing (FR-008) — a single PATCH call; on any failure nothing
    // submitted here is saved, since the backend update() runs inside one
    // transaction (companies.service.ts).
    const { error } = await client.PATCH('/admin/companies/{companyId}', {
      params: { path: { companyId } },
      body: {
        contact_person: contactPerson.trim(),
        mobile: mobile.trim(),
        email: email.trim(),
        address: address.trim(),
        // Sent even when empty (not omitted) so clearing the field back to
        // blank actually clears operating_hours rather than leaving the
        // previous value untouched (PATCH's "omitted = unchanged" rule).
        operating_hours: operatingHours.trim(),
      },
    });

    if (error) {
      // FR-007 — invalid Email/Phone Number format surfaces here as a
      // field-specific backend validation message, nothing saved.
      setErrorMessage((error as { message?: string })?.message ?? 'Could not save Contact Us details.');
      setSaving(false);
      return;
    }

    navigation.goBack();
  }

  if (loading) {
    return <Screen title="Contact Us" />;
  }

  return (
    <Screen title="Contact Us">
      <View className="gap-3">
        <Text className="text-body-bold text-text-primary">{companyName}</Text>

        <TextInput
          className="border border-border rounded-lg px-3 py-2 text-text-primary"
          placeholder="Contact Person"
          value={contactPerson}
          onChangeText={setContactPerson}
        />
        <TextInput
          className="border border-border rounded-lg px-3 py-2 text-text-primary"
          placeholder="Phone Number"
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
        <TextInput
          className="border border-border rounded-lg px-3 py-2 text-text-primary"
          placeholder="Operating Hours (e.g. Mon–Sat, 9:00 AM – 8:00 PM)"
          value={operatingHours}
          onChangeText={setOperatingHours}
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
            <PrimaryButton label="Save" onPress={handleSave} loading={saving} disabled={saving} />
          </View>
        </View>
      </View>
    </Screen>
  );
}
