import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
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
    <Screen title="Feedback">
      <View className="gap-4">
        <View className="gap-1">
          <Text className="text-body-bold text-text-primary">Rating (optional)</Text>
          <View className="flex-row gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable key={star} onPress={() => setRating(rating === star ? undefined : star)} hitSlop={6}>
                <Text style={{ fontSize: 28 }}>{rating !== undefined && star <= rating ? '★' : '☆'}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Dropdown<Category>
          label="Category"
          value={category}
          options={CATEGORY_OPTIONS}
          onChange={setCategory}
          placeholder="Select a category..."
        />

        <View className="gap-1">
          <Text className="text-body-bold text-text-primary">Message</Text>
          <TextInput
            className="border border-border rounded-lg px-3 py-2 text-text-primary min-h-24"
            placeholder={`Tell us more — what happened, or what would make ${tenantName} better?`}
            placeholderTextColor="#9CA3AF"
            multiline
            textAlignVertical="top"
            maxLength={1000}
            value={message}
            onChangeText={setMessage}
          />
        </View>

        <View className="flex-row items-center justify-between border-t border-border pt-3">
          <Text className="text-body text-text-primary flex-1 mr-2">Contact me back</Text>
          <Switch value={contactRequested} onValueChange={setContactRequested} />
        </View>
        {contactRequested ? (
          <Text className="text-caption text-text-secondary -mt-2">
            We'll reach out at your registered email: {userEmail ?? '—'}
          </Text>
        ) : null}

        {errorMessage ? <Text className="text-body text-red-600">{errorMessage}</Text> : null}

        <PrimaryButton label="Submit" onPress={handleSubmit} loading={submitting} disabled={submitting} />
      </View>
    </Screen>
  );
}
