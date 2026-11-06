import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { HeroCard } from '../../components/HeroCard';
import { InfoCard, InfoRow } from '../../components/InfoCard';
import { colors, radius } from '../../theme/tokens';
import { createTypedClient } from '../../api/client';
import type { paths } from '../../api/generated/015-contact-us-page';

const client = createTypedClient<paths>();

type ContactUs = {
  // Already returned by GET /me/contact-us (specs/015 ContactUs schema);
  // the local projection simply did not read it. Using it adds no request
  // and changes nothing the app sends or expects (FR-032).
  company_name: string;
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
        <Text className="text-body text-red-strong">{errorMessage ?? 'Contact Us details are unavailable.'}</Text>
      </Screen>
    );
  }

  return (
    <Screen title="Contact Us">
      <View className="gap-md">
        <Text className="text-title text-text-primary">Contact us</Text>

        <HeroCard className="gap-sm">
          <View
            style={{ borderRadius: radius.xl }}
            className="w-control h-control bg-espresso items-center justify-center overflow-hidden"
          >
            <Image
              source={require('../../../assets/brand/gf-mark-white.png')}
              style={{ width: 40, height: 40 }}
              resizeMode="contain"
              accessibilityLabel=""
            />
          </View>
          <Text className="text-titleSm text-espresso">{contactUs.company_name}</Text>
          {/* Null or an empty string renders as "Not specified" (FR-005),
              never a blank line. */}
          <View className="self-start bg-espresso rounded-pill px-sm py-xs">
            <Text className="text-label text-surface">
              {contactUs.operating_hours?.trim() || 'Not specified'}
            </Text>
          </View>
        </HeroCard>

        <InfoCard>
          <InfoRow
            label="Contact person"
            value={contactUs.contact_person}
            icon={{ glyph: '👤', accent: 'neutral' }}
          />
          {/* Phone and email have opened the dialler and mail client since
              specs/015. FR-038 bars ADDING that affordance; removing it
              would itself be a behavioural change (FR-030), so the
              behaviour stays and only the styling changed. */}
          <Pressable onPress={() => void Linking.openURL(`tel:${contactUs.phone_number}`)} hitSlop={8}>
            <InfoRow
              label="Phone"
              value={contactUs.phone_number}
              icon={{ glyph: '📞', accent: 'mint' }}
            />
          </Pressable>
          <Pressable onPress={() => void Linking.openURL(`mailto:${contactUs.email}`)} hitSlop={8}>
            <InfoRow
              label="Email"
              value={contactUs.email}
              icon={{ glyph: '✉️', accent: 'violet' }}
            />
          </Pressable>
          <InfoRow
            label="Address"
            value={contactUs.address}
            icon={{ glyph: '📍', accent: 'sun' }}
            last
          />
        </InfoCard>

        <View
          style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius['5xl'] }}
          className="bg-surface p-md gap-xs"
        >
          <Text className="text-bodyBold text-text-primary">Something to tell us?</Text>
          <Text className="text-caption text-text-secondary">Share feedback with the canteen</Text>
        </View>
      </View>
    </Screen>
  );
}
