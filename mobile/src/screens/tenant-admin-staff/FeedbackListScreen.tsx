import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { colors, radius } from '../../theme/tokens';
import { CategoryChip } from '../../components/CategoryChip';
import { createTypedClient } from '../../api/client';
import type { TenantAdminStaffStackParamList } from '../../navigation/TenantAdminStaffNavigator';
import type { paths } from '../../api/generated/016-feedback-management';

type Props = NativeStackScreenProps<TenantAdminStaffStackParamList, 'FeedbackList'>;

const client = createTypedClient<paths>();

type Status = 'new' | 'resolved';
type Feedback = {
  id: string;
  rating: number | null;
  category: string;
  message: string;
  contact_requested: boolean;
  status: Status;
  submitted_by: { id: string; name: string };
  created_at: string;
};

const FILTERS: { label: string; value: Status | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'New', value: 'new' },
  { label: 'Resolved', value: 'resolved' },
];

const CATEGORY_LABELS: Record<string, string> = {
  app_experience: 'App Experience',
  food_order_quality: 'Food/Order Quality',
  payment_issue: 'Payment Issue',
  pickup_experience: 'Pickup Experience',
  suggestion: 'Suggestion',
  other: 'Other',
};

/**
 * specs/016-feedback-management User Story 2 — Company Admin only (this
 * screen is only ever reached from the Company-Admin-only "Feedback Review"
 * drawer item, AppShell.tsx). Newest first, optional status filter
 * (FR-010/FR-011).
 */
export function FeedbackListScreen({ navigation }: Props) {
  const [status, setStatus] = useState<Status | undefined>(undefined);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async (nextStatus: Status | undefined) => {
    setLoading(true);
    setErrorMessage(null);
    const { data, error } = await client.GET('/tenant/feedback', {
      params: { query: nextStatus ? { status: nextStatus } : {} },
    });
    if (error) {
      setErrorMessage((error as { message?: string })?.message ?? 'Could not load feedback.');
    } else if (data) {
      setFeedback(data as Feedback[]);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(status);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load]),
  );

  function handleFilterChange(nextStatus: Status | undefined) {
    setStatus(nextStatus);
    load(nextStatus);
  }

  return (
    <Screen surface="admin" title="Feedback Review" scroll={false}>
      <View className="flex-row mb-3">
        {FILTERS.map((filter) => (
          <CategoryChip
            key={filter.label}
            label={filter.label}
            selected={status === filter.value}
            onPress={() => handleFilterChange(filter.value)}
          />
        ))}
      </View>

      {errorMessage ? <Text className="text-body text-red-strong mb-3">{errorMessage}</Text> : null}

      {loading ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          className="flex-1"
          contentContainerStyle={{ gap: 10 }}
          data={feedback}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <Text className="text-body text-text-secondary text-center mt-8">No feedback yet.</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={{ borderRadius: radius['3xl'], borderWidth: 1, borderColor: colors.borderSoft }}
              className="bg-surface p-md gap-xs active:opacity-80"
              onPress={() => navigation.navigate('FeedbackDetail', { feedbackId: item.id })}
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-bodyBold text-text-primary">{CATEGORY_LABELS[item.category] ?? item.category}</Text>
                <View
                  className={`rounded-pill px-sm py-xs ${
                    item.status === 'resolved' ? 'bg-mint-soft' : 'bg-sun-soft'
                  }`}
                >
                  <Text
                    className={`text-eyebrow ${
                      item.status === 'resolved' ? 'text-mint-strong' : 'text-sun-strong'
                    }`}
                  >
                    {item.status === 'resolved' ? 'Resolved' : 'New'}
                  </Text>
                </View>
              </View>
              <Text className="text-body text-text-secondary" numberOfLines={2}>
                {item.message}
              </Text>
              <View className="flex-row items-center gap-3 mt-1">
                {item.rating ? <Text className="text-caption text-text-secondary">{'★'.repeat(item.rating)}</Text> : null}
                <Text className="text-caption text-text-secondary">{item.submitted_by.name}</Text>
                {item.contact_requested ? <Text className="text-label text-link">Wants contact</Text> : null}
              </View>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}
