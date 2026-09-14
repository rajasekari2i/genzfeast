import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { createTypedClient } from '../../api/client';
import type { TenantAdminStaffStackParamList } from '../../navigation/TenantAdminStaffNavigator';
import type { paths } from '../../api/generated/016-feedback-management';

type Props = NativeStackScreenProps<TenantAdminStaffStackParamList, 'FeedbackDetail'>;

const client = createTypedClient<paths>();

type Status = 'new' | 'resolved';
type FeedbackDetail = {
  id: string;
  rating: number | null;
  category: string;
  message: string;
  contact_requested: boolean;
  contact_email: string | null;
  status: Status;
  submitted_by: { id: string; name: string };
  created_at: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  app_experience: 'App Experience',
  food_order_quality: 'Food/Order Quality',
  payment_issue: 'Payment Issue',
  pickup_experience: 'Pickup Experience',
  suggestion: 'Suggestion',
  other: 'Other',
};

/**
 * specs/016-feedback-management User Story 2/3 — full detail (Company Admin
 * only), including the submitter's registered email whenever "Contact me
 * back" was requested (FR-012, research.md §3). The Resolve action is
 * one-way (new -> resolved) and hidden once already resolved (research.md
 * §5) — this screen never offers to reopen one.
 */
export function FeedbackDetailScreen({ route }: Props) {
  const { feedbackId } = route.params;
  const [feedback, setFeedback] = useState<FeedbackDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    const { data, error } = await client.GET('/tenant/feedback/{feedbackId}', {
      params: { path: { feedbackId } },
    });
    if (error) {
      setErrorMessage((error as { message?: string })?.message ?? 'Could not load this feedback.');
    } else if (data) {
      setFeedback(data as FeedbackDetail);
    }
    setLoading(false);
  }, [feedbackId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleResolve() {
    setResolving(true);
    setErrorMessage(null);
    const { data, error } = await client.PATCH('/tenant/feedback/{feedbackId}/resolve', {
      params: { path: { feedbackId } },
    });
    if (error) {
      setErrorMessage((error as { message?: string })?.message ?? 'Could not resolve this feedback.');
    } else if (data && feedback) {
      setFeedback({ ...feedback, status: (data as { status: Status }).status });
    }
    setResolving(false);
  }

  if (loading) {
    return (
      <Screen title="Feedback">
        <ActivityIndicator />
      </Screen>
    );
  }

  if (errorMessage && !feedback) {
    return (
      <Screen title="Feedback">
        <Text className="text-body text-red-600">{errorMessage}</Text>
      </Screen>
    );
  }

  if (!feedback) {
    return null;
  }

  return (
    <Screen title="Feedback">
      <View className="gap-4">
        <View
          className={`self-start rounded-pill px-3 py-1 border ${
            feedback.status === 'resolved' ? 'border-green-600 bg-green-50' : 'border-amber-500 bg-amber-50'
          }`}
        >
          <Text
            className={`text-caption font-semibold ${
              feedback.status === 'resolved' ? 'text-green-700' : 'text-amber-700'
            }`}
          >
            {feedback.status === 'resolved' ? 'Resolved' : 'New'}
          </Text>
        </View>

        <Field label="Category" value={CATEGORY_LABELS[feedback.category] ?? feedback.category} />
        {feedback.rating ? <Field label="Rating" value={'★'.repeat(feedback.rating)} /> : null}
        <Field label="Message" value={feedback.message} />
        <Field label="Submitted by" value={feedback.submitted_by.name} />
        {feedback.contact_requested ? (
          <Field label="Wants contact back at" value={feedback.contact_email ?? '—'} />
        ) : null}

        {errorMessage ? <Text className="text-body text-red-600">{errorMessage}</Text> : null}

        {feedback.status === 'new' ? (
          <PrimaryButton label="Mark Resolved" onPress={handleResolve} loading={resolving} disabled={resolving} />
        ) : null}
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
