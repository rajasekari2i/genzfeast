import type { Feedback } from '@prisma/client';
import type { FeedbackCategory, FeedbackStatus } from './feedback-category.constants';

/** Wire shape of contracts/openapi.yaml's Feedback schema. */
export interface FeedbackResponse {
  id: string;
  company_id: string;
  rating: number | null;
  category: FeedbackCategory;
  message: string;
  contact_requested: boolean;
  status: FeedbackStatus;
  submitted_by: { id: string; name: string };
  created_at: string;
  updated_at: string;
}

/** Wire shape of contracts/openapi.yaml's FeedbackDetail schema — Feedback + contact_email. */
export interface FeedbackDetailResponse extends FeedbackResponse {
  contact_email: string | null;
}

type FeedbackWithSubmitter = Feedback & { user: { id: string; name: string } };
type FeedbackWithSubmitterEmail = Feedback & { user: { id: string; name: string; email: string } };

export function toResponse(feedback: FeedbackWithSubmitter): FeedbackResponse {
  return {
    id: feedback.id,
    company_id: feedback.companyId,
    rating: feedback.rating,
    category: feedback.category as FeedbackCategory,
    message: feedback.message,
    contact_requested: feedback.contactRequested,
    status: feedback.status as FeedbackStatus,
    submitted_by: { id: feedback.user.id, name: feedback.user.name },
    created_at: feedback.createdAt.toISOString(),
    updated_at: feedback.updatedAt.toISOString(),
  };
}

/**
 * research.md §3: `contact_email` is resolved at read time from the
 * submitter's own (already-joined) `users.email` — never duplicated onto
 * the `feedback` row itself, so it can never go stale relative to a later
 * profile edit. Present only when `contact_requested` is true (FR-012).
 */
export function toDetailResponse(feedback: FeedbackWithSubmitterEmail): FeedbackDetailResponse {
  return {
    ...toResponse(feedback),
    contact_email: feedback.contactRequested ? feedback.user.email : null,
  };
}
