import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { DrawerActions, useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Icon } from '../../components/Icon';
import { CategoryChip } from '../../components/CategoryChip';
import { SwitchRow } from '../../components/SwitchRow';
import { colors, radius } from '../../theme/tokens';
import { PrimaryButton } from '../../components/PrimaryButton';
import { Dropdown, DropdownOption } from '../../components/Dropdown';
import { createTypedClient, getCurrentUser } from '../../api/client';
import type { FeedbackStackParamList } from '../../navigation/FeedbackNavigator';
import type { paths as FeedbackPaths } from '../../api/generated/016-feedback-management';
import type { paths as ContactUsPaths } from '../../api/generated/015-contact-us-page';
import type { paths as ProfilePaths } from '../../api/generated/007-user-profile-management';

type Props = NativeStackScreenProps<FeedbackStackParamList, 'Feedback'>;

const feedbackClient = createTypedClient<FeedbackPaths>();
const contactUsClient = createTypedClient<ContactUsPaths>();
const profileClient = createTypedClient<ProfilePaths>();

type Category = 'app_experience' | 'food_order_quality' | 'payment_issue' | 'pickup_experience' | 'suggestion' | 'other';

const CATEGORY_OPTIONS: DropdownOption<Category>[] = [
  { label: 'App Experience', value: 'app_experience' },
  { label: 'Food/Order Quality', value: 'food_order_quality' },
  { label: 'Payment Issue', value: 'payment_issue' },
  { label: 'Pickup Experience', value: 'pickup_experience' },
  { label: 'Suggestion', value: 'suggestion' },
  { label: 'Other', value: 'other' },
];

/** The closest "home base" drawer route for a role that has no dedicated Home/Dashboard screen (FR-008's "no dead-end, link back to Home" — Teaching/Non-Teaching only have Profile/Contact Us/Feedback, per CLAUDE.md/015). */
const HOME_ROUTE_BY_ROLE: Record<string, string> = {
  student: 'Home',
  company_admin: 'Dashboard',
  company_staff: 'Incoming Orders',
};

/**
 * specs/016-feedback-management User Story 1 — rating/category/message/
 * contact-me-back/submit, reachable by every tenant role (Student, Teaching,
 * Non-Teaching, Company Staff, Company Admin). `company_name` (for the
 * prompt/success copy) and the caller's own registered email (for the
 * read-only "Contact me back" display) are both fetched once on mount —
 * neither is asked of the user again (FR-004/FR-005/FR-008).
 */
export function FeedbackScreen({ navigation }: Props) {
  const [rating, setRating] = useState<number | undefined>(undefined);
  const [category, setCategory] = useState<Category | undefined>(undefined);
  const [message, setMessage] = useState('');
  const [contactRequested, setContactRequested] = useState(false);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setRating(undefined);
    setCategory(undefined);
    setMessage('');
    setContactRequested(false);
    setSubmitted(false);
    setErrorMessage(null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      resetForm();
      (async () => {
        const user = await getCurrentUser();
        setRole(user?.role);
        const [contactUs, profile] = await Promise.all([
          contactUsClient.GET('/me/contact-us', {}),
          profileClient.GET('/me/profile', {}),
        ]);
        if (contactUs.data) setCompanyName((contactUs.data as { company_name?: string }).company_name ?? null);
        if (profile.data) setUserEmail((profile.data as { email?: string }).email ?? null);
      })();
    }, [resetForm]),
  );

  async function handleSubmit() {
    setErrorMessage(null);
    if (!category) {
      setErrorMessage('Please select a Category.');
      return;
    }
    if (!message.trim()) {
      setErrorMessage('Please tell us what happened.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await feedbackClient.POST('/me/feedback', {
        body: {
          rating,
          category,
          message: message.trim(),
          contact_requested: contactRequested,
        },
      });
      if (error) {
        const msg = (error as { message?: string } | undefined)?.message;
        setErrorMessage(msg ?? 'Could not submit your feedback. Please try again.');
        return;
      }
      setSubmitted(true);
    } catch {
      setErrorMessage('Could not reach the server. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleBackToHome() {
    const homeRoute = (role && HOME_ROUTE_BY_ROLE[role]) ?? 'Profile';
    navigation.getParent()?.navigate(homeRoute as never);
  }

  const tenantName = companyName ?? 'your canteen';

  if (submitted) {
    return (
      <Screen title="Feedback">
        <View className="gap-4 items-center py-8">
          <Text className="text-h2 text-text-primary text-center">
            Thanks! Your feedback helps us improve {tenantName}.
          </Text>
          <PrimaryButton label="Back to Home" onPress={handleBackToHome} />
          <Text className="text-body text-text-secondary text-center" onPress={resetForm}>
            Submit more feedback
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen title="Feedback" scroll={false}>
      <View className="flex-1 gap-md">
        {/* Same header row as Profile and Contact us — the artboards share
            it across the student journey. */}
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
          <Text className="flex-1 text-title text-text-primary">Feedback</Text>
        </View>

        {/* Rating — a brand-filled panel with five fillable tiles rather
            than a row of glyphs. Optional (FR-013.2); tapping the current
            value clears it. */}
        <View
          style={{ backgroundColor: colors.primary, borderRadius: radius['5xl'] }}
          className="p-md gap-sm"
        >
          <Text className="text-title-md text-espresso">
            How was it? <Text className="text-label text-espresso">(optional)</Text>
          </Text>
          <View className="flex-row gap-xs">
            {[1, 2, 3, 4, 5].map((star) => {
              const filled = rating !== undefined && star <= rating;
              return (
                <Pressable
                  key={star}
                  onPress={() => setRating(rating === star ? undefined : star)}
                  accessibilityRole="button"
                  accessibilityLabel={`${star} star${star > 1 ? 's' : ''}`}
                  accessibilityState={{ selected: filled }}
                  style={{
                    backgroundColor: filled ? colors.espresso : colors.surface,
                    borderRadius: radius.xl,
                  }}
                  className="flex-1 h-control items-center justify-center"
                >
                  {/* The artboard draws the star and varies its FILL by
                      state, keeping the espresso outline throughout — the
                      ★ character cannot express that. */}
                  <Icon
                    name="star"
                    size={26}
                    color={colors.espresso}
                    fill={filled ? colors.accent : colors.surface}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* The six fixed categories as chips — the artboard shows them all
            at once rather than behind a picker, so the choice is visible. */}
        <View className="gap-sm">
          <Text className="text-label text-text-body">What's it about?</Text>
          <View className="flex-row flex-wrap">
            {CATEGORY_OPTIONS.map((option) => (
              <CategoryChip
                key={option.value}
                label={option.label}
                selected={category === option.value}
                onPress={() => setCategory(option.value)}
              />
            ))}
          </View>
        </View>

        <View className="gap-xs">
          <Text className="text-label text-text-body">Message</Text>
          <TextInput
            style={{ borderWidth: 1.5, borderColor: colors.espresso, borderRadius: radius['2xl'], height: 118 }}
            className="bg-surface px-md py-sm text-body-lg text-text-primary"
            placeholder={`Tell us more — what happened, or what would make ${tenantName} better?`}
            placeholderTextColor={colors.textSecondary}
            multiline
            textAlignVertical="top"
            maxLength={1000}
            value={message}
            onChangeText={setMessage}
          />
        </View>

        <View
          style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius['2xl'] }}
          className="bg-surface p-md gap-sm"
        >
          <SwitchRow
            label="Contact me back"
            value={contactRequested}
            onValueChange={setContactRequested}
            onLabel="We'll reply to your registered email"
            offLabel="No reply needed"
          />
          {contactRequested ? (
            <View
              style={{
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderColor: colors.borderDashed,
                borderRadius: radius.md,
              }}
              className="h-touch px-sm justify-center bg-disabled-fill"
            >
              <Text className="text-body text-text-secondary">{userEmail ?? '—'}</Text>
            </View>
          ) : null}
        </View>

        {errorMessage ? <Text className="text-body text-red-strong">{errorMessage}</Text> : null}

        {/* Pinned to the bottom with a trailing arrow, per the artboard —
            not the standard filled button. */}
        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityState={{ disabled: submitting }}
          style={{ height: 56, borderRadius: radius.pill, opacity: submitting ? 0.6 : 1 }}
          className="mt-auto bg-espresso flex-row items-center justify-center gap-xs"
        >
          <Text className="text-price text-surface">Send feedback</Text>
          <Icon name="arrowRight" size={18} color={colors.surface} />
        </Pressable>
      </View>
    </Screen>
  );
}
