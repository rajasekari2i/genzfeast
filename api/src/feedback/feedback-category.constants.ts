/**
 * Fixed, platform-wide feedback classification (specs/016-feedback-management
 * research.md §1) — a `text` + `CHECK` column (data-model.md §1), not a
 * lookup table or a Postgres enum, per `coding_standard.md` §2's convention
 * for domain-value columns. Unrelated to `Category` (specs/001), which is
 * per-tenant registrant-affiliation master data, not a feedback concept.
 */
export const FeedbackCategory = {
  AppExperience: 'app_experience',
  FoodOrderQuality: 'food_order_quality',
  PaymentIssue: 'payment_issue',
  PickupExperience: 'pickup_experience',
  Suggestion: 'suggestion',
  Other: 'other',
} as const;

export type FeedbackCategory = (typeof FeedbackCategory)[keyof typeof FeedbackCategory];

export const FEEDBACK_CATEGORY_VALUES: FeedbackCategory[] = Object.values(FeedbackCategory);

/** 'new' | 'resolved' — two-state, one-way (research.md §5). */
export const FeedbackStatus = {
  New: 'new',
  Resolved: 'resolved',
} as const;

export type FeedbackStatus = (typeof FeedbackStatus)[keyof typeof FeedbackStatus];

export const FEEDBACK_STATUS_VALUES: FeedbackStatus[] = Object.values(FeedbackStatus);
