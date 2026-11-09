import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { AdminPageHeader } from '../../components/AdminPageHeader';
import { Icon } from '../../components/Icon';
import { StatusBadge } from '../../components/StatusBadge';
import { avatarTint, tile } from '../../theme/accents';
import { colors, radius, size } from '../../theme/tokens';
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
/**
 * The artboard's header reads "Today, 1:12 PM" — a relative day plus the
 * time, not a full date. Kept local to this screen: it is the only place
 * that renders a feedback timestamp.
 */
function formatSubmittedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const yesterday = new Date(today.getTime() - 86_400_000).toDateString() === d.toDateString();
  if (sameDay) return `Today, ${time}`;
  if (yesterday) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, ${time}`;
}

export function FeedbackDetailScreen({ route, navigation }: Props) {
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
      <Screen surface="admin" title="Feedback">
        <ActivityIndicator />
      </Screen>
    );
  }

  if (errorMessage && !feedback) {
    return (
      <Screen title="Feedback">
        <Text className="text-body text-red-strong">{errorMessage}</Text>
      </Screen>
    );
  }

  if (!feedback) {
    return null;
  }

  const submitter = avatarTint(feedback.id);
  // The artboard draws the contact strip in the blue family.
  const contactTile = tile('blue');

  return (
    <Screen
      surface="admin"
      title="Feedback"
      scroll={false}
      header={
        <AdminPageHeader
          title={CATEGORY_LABELS[feedback.category] ?? feedback.category}
          meta={formatSubmittedAt(feedback.created_at)}
          badge={<StatusBadge status={feedback.status === 'resolved' ? 'resolved' : 'new'} />}
          onBack={() => navigation.goBack()}
        />
      }
    >
      {/* Section 13's own order: Rating, then Message, then Submitted by —
          each its own white card at radius 22, rather than the single
          InfoCard list this screen used to render. The category is the
          HEADLINE here, not a row in a list. */}
      <ScrollView className="flex-1" contentContainerStyle={{ gap: 14, paddingBottom: 8 }}>
        {feedback.rating ? (
          <View
            style={{ borderRadius: radius['4xl'], borderWidth: 1, borderColor: colors.borderCard }}
            className="bg-surface px-md py-sm flex-row items-center justify-between"
          >
            <Text className="text-label text-text-secondary">Rating</Text>
            <View
              className="flex-row gap-xs"
              accessibilityRole="image"
              accessibilityLabel={`${feedback.rating} out of 5 stars`}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <Icon
                  key={n}
                  name="star"
                  size={20}
                  color={colors.espresso}
                  fill={n <= (feedback.rating ?? 0) ? colors.accent : colors.surface}
                />
              ))}
            </View>
          </View>
        ) : null}

        <View
          style={{ borderRadius: radius['4xl'], borderWidth: 1, borderColor: colors.borderCard }}
          className="bg-surface p-md gap-xs"
        >
          <Text className="text-label text-text-secondary">Message</Text>
          <Text className="text-body-lg text-text-primary">{feedback.message}</Text>
        </View>

        <View
          style={{ borderRadius: radius['4xl'], borderWidth: 1, borderColor: colors.borderCard }}
          className="bg-surface px-md py-sm gap-md"
        >
          <View className="flex-row items-center gap-sm">
            <View
              style={{
                width: size.touch,
                height: size.touch,
                borderRadius: size.touch / 2,
                backgroundColor: submitter.backgroundColor,
              }}
              className="items-center justify-center"
            >
              <Text style={{ color: submitter.color }} className="text-subtitle-sm">
                {feedback.submitted_by.name.trim().charAt(0).toUpperCase()}
              </Text>
            </View>
            <View className="gap-glyph">
              <Text className="text-caption text-text-secondary">Submitted by</Text>
              <Text className="text-body-bold text-text-primary">{feedback.submitted_by.name}</Text>
            </View>
          </View>

          {feedback.contact_requested ? (
            <View
              style={{ borderRadius: radius.xl, backgroundColor: contactTile.backgroundColor }}
              className="flex-row items-center gap-sm px-md py-sm"
            >
              <Icon name="email" size={20} color={contactTile.color} />
              <View className="flex-1 gap-glyph">
                <Text style={{ color: contactTile.color }} className="text-caption">
                  Wants contact back at
                </Text>
                <Text style={{ color: contactTile.color }} className="text-body-bold" numberOfLines={1}>
                  {feedback.contact_email ?? '—'}
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        {errorMessage ? <Text className="text-body text-red-strong">{errorMessage}</Text> : null}
      </ScrollView>

      {feedback.status === 'new' ? (
        <View className="gap-xs pt-sm">
          <Pressable
            onPress={handleResolve}
            disabled={resolving}
            accessibilityRole="button"
            accessibilityState={{ disabled: resolving }}
            style={{
              height: 56,
              borderRadius: radius.pill,
              backgroundColor: colors.primaryVariant,
              opacity: resolving ? 0.6 : 1,
            }}
            className="flex-row items-center justify-center gap-xs"
          >
            {resolving ? <ActivityIndicator size="small" color={colors.surface} /> : (
              <Icon name="check" size={18} color={colors.surface} />
            )}
            <Text className="text-price text-surface">Mark resolved</Text>
          </Pressable>
          {/* One-way by design (FR-041) — there is no un-resolve path, and
              the screen says so before the action rather than after. */}
          <Text className="text-caption text-text-secondary text-center">
            Resolved feedback can't be reopened.
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}
