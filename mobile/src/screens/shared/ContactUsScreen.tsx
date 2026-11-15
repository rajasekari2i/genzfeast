import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, Text, View } from 'react-native';
import { CommonActions, DrawerActions, useFocusEffect, useNavigation } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { Icon } from '../../components/Icon';
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
  // This screen takes no route props — it is mounted directly by
  // ContactUsNavigator — so the back control and the Feedback link reach
  // navigation through the hook instead.
  const navigation = useNavigation();
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
    <Screen title="Contact Us" scroll={false}>
      <View className="flex-1 gap-md">
        {/* Same header row as Profile — the artboards share it across every
            student-journey screen. */}
        <View className="flex-row items-center gap-sm">
          <Pressable
            onPress={() =>
              // "Back to menu" in the artboard. These three are DRAWER
              // destinations, not pushed routes, so canGoBack() is not a
              // reliable signal here — it consults the whole navigator tree
              // and returned true while there was nothing to pop, leaving
              // the control dead and the user with no route to the menu now
              // that the drawer header is hidden. Always open the drawer.
              navigation.dispatch(DrawerActions.openDrawer())
            }
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={{ borderWidth: 1, borderColor: colors.borderSoft }}
            className="w-touch h-touch rounded-pill bg-surface items-center justify-center"
          >
            <Icon name="chevronLeft" size={20} color={colors.espresso} />
          </Pressable>
          <Text className="flex-1 text-title text-text-primary">Contact us</Text>
        </View>

        {/* Hero — note the sun disc sits TOP-right here, where Profile's is
            bottom-right. Canteen name is 30/32/-1, a size up from Profile's. */}
        <View
          style={{ borderRadius: radius['6xl'], backgroundColor: colors.primary }}
          className="gap-sm p-lg overflow-hidden"
        >
          <View
            style={{
              position: 'absolute',
              right: -40,
              top: -40,
              width: 150,
              height: 150,
              borderRadius: radius.pill,
              backgroundColor: colors.accent,
            }}
          />
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
          <Text className="text-display-xs text-espresso">{contactUs.company_name}</Text>
          {/* Null or an empty string renders as "Not specified" (FR-005),
              never a blank line. The clock glyph is struck in Sun, per the
              artboard, not in the pill's own white. */}
          <View className="self-start flex-row items-center gap-xs bg-espresso rounded-pill px-md py-xs">
            <Icon name="clock" size={15} color={colors.accent} />
            <Text className="text-label text-surface">
              {contactUs.operating_hours?.trim() || 'Not specified'}
            </Text>
          </View>
        </View>

        <InfoCard>
          <InfoRow
            label="Contact person"
            value={contactUs.contact_person}
            icon={{ icon: 'profile', accent: 'neutral' }}
          />
          {/* Phone and email have opened the dialler and mail client since
              specs/015. FR-038 bars ADDING that affordance; removing it
              would itself be a behavioural change (FR-030), so the
              behaviour stays and only the styling changed. */}
          <Pressable onPress={() => void Linking.openURL(`tel:${contactUs.phone_number}`)} hitSlop={8}>
            <InfoRow label="Phone" value={contactUs.phone_number} icon={{ icon: 'contactUs', accent: 'mint' }} />
          </Pressable>
          <Pressable onPress={() => void Linking.openURL(`mailto:${contactUs.email}`)} hitSlop={8}>
            <InfoRow label="Email" value={contactUs.email} icon={{ icon: 'email', accent: 'tangerine' }} />
          </Pressable>
          <InfoRow label="Address" value={contactUs.address} icon={{ icon: 'pin', accent: 'sun' }} last />
        </InfoCard>

        {/* The artboard makes this a LINK to Feedback with a dashed warm
            rule, not the solid card it was. Feedback is its own drawer
            route, so this reaches it through the parent navigator. */}
        <Pressable
          onPress={() =>
            // Same reasoning as the back control: dispatch on this
            // navigator and let the action bubble to whichever navigator
            // owns the Feedback route.
            navigation.dispatch(CommonActions.navigate({ name: 'Feedback' }))
          }
          accessibilityRole="button"
          style={{
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: colors.borderDashedWarm,
            borderRadius: radius['4xl'],
          }}
          className="mt-auto flex-row items-center gap-sm p-md"
        >
          <View className="flex-1 gap-glyph">
            <Text className="text-body-bold text-text-primary">Something to tell us?</Text>
            <Text className="text-label text-text-secondary">Share feedback with the canteen</Text>
          </View>
          <Icon name="chevronRight" size={20} color={colors.espresso} />
        </Pressable>
      </View>
    </Screen>
  );
}
