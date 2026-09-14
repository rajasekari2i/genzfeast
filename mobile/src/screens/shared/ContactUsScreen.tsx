import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { createTypedClient } from '../../api/client';
import type { paths } from '../../api/generated/015-contact-us-page';

const client = createTypedClient<paths>();

type ContactUs = {
  contact_person: string;
  phone_number: string;
  email: string;
  address: string;
  operating_hours: string | null;
};

/**
 * specs/015-contact-us-page User Story 1 + 3 — read-only for every tenant
 * role (Company Admin, Company Staff, Student, Teaching, Non-Teaching); no
 * edit action anywhere on this screen (FR-004). Tap-to-call/tap-to-email
 * via React Native's built-in Linking (FR-010) — Address stays plain text.
 */
export function ContactUsScreen() {
  const [contactUs, setContactUs] = useState<ContactUs | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    const { data, error } = await client.GET('/me/contact-us', {});
    if (error) {
      setErrorMessage((error as { message?: string })?.message ?? 'Could not load Contact Us.');
    } else if (data) {
      setContactUs(data as ContactUs);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading) {
    return (
      <Screen title="Contact Us">
        <ActivityIndicator />
      </Screen>
    );
  }

  if (errorMessage || !contactUs) {
    return (
      <Screen title="Contact Us">
        <Text className="text-body text-red-600">{errorMessage ?? 'Contact Us details are unavailable.'}</Text>
      </Screen>
    );
  }

  return (
    <Screen title="Contact Us">
      <View className="gap-4">
        <Field label="Contact Person" value={contactUs.contact_person} />

        <View className="border-b border-border pb-2">
          <Text className="text-caption text-text-secondary">Phone Number</Text>
          <Pressable onPress={() => void Linking.openURL(`tel:${contactUs.phone_number}`)} hitSlop={8}>
            <Text className="text-body text-primary underline">{contactUs.phone_number}</Text>
          </Pressable>
        </View>

        <View className="border-b border-border pb-2">
          <Text className="text-caption text-text-secondary">Email</Text>
          <Pressable onPress={() => void Linking.openURL(`mailto:${contactUs.email}`)} hitSlop={8}>
            <Text className="text-body text-primary underline">{contactUs.email}</Text>
          </Pressable>
        </View>

        <Field label="Address" value={contactUs.address} />

        {/* Null (or an empty string, once cleared) renders as "Not
            specified" (FR-005) rather than a blank field. */}
        <Field label="Operating Hours" value={contactUs.operating_hours?.trim() || 'Not specified'} />
      </View>
    </Screen>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View className="border-b border-border pb-2">
      <Text className="text-caption text-text-secondary">{label}</Text>
      <Text className="text-body text-text-primary">{value}</Text>
    </View>
  );
}
