# Quickstart: Validating Feedback Management

**Feature**: `016-feedback-management`

Manual/scriptable validation guide against `contracts/openapi.yaml` and `data-model.md`. Requires `001`'s `companies`/`users` and `002`'s JWT auth in place. Needs at least one Student account, one Company Staff or Teaching/Non-Teaching account, and one Company Admin account in Company A, plus a second Company (B) with its own Company Admin, to test cross-tenant rejection.

## Prerequisites

- A running API instance with `001`'s `companies`/`users` migrations applied.
- Two Companies (A and B), each with at least one Company Admin.
- At least one non-admin account (Student, Teaching, Non-Teaching, or Company Staff) in Company A.

## Scenario 1 — Submit feedback (User Story 1)

1. As the Company A Student, `POST /me/feedback` with `{ category: "food_order_quality", message: "The samosas were cold today." }` (no rating, no contact_requested).
   - **Expect**: `201`; response has `status: "new"`, `rating: null`, `company_id` equal to Company A's id (never client-supplied — the request body has no `company_id` field at all).
2. As the Company A Company Staff account, `POST /me/feedback` with a `rating` of `4` included.
   - **Expect**: `201`; `rating: 4` persisted. Confirms every in-scope role (not just Student) can submit (FR-001).
3. As the Company A Student, `POST /me/feedback` with `contact_requested: true`.
   - **Expect**: `201`; `contact_requested: true` in the response, and no email was included in or echoed by the request (the client already has it from the user's own profile — FR-005).
4. `POST /me/feedback` with `message` omitted.
   - **Expect**: `400`; no record created (FR-007) — confirm via a follow-up list call (Scenario 2) that the count didn't increase.
5. `POST /me/feedback` with `category` omitted.
   - **Expect**: `400`; no record created (FR-007).
6. `POST /me/feedback` with `category: "not_a_real_category"`.
   - **Expect**: `400`.
7. As the Company Admin of Company A, `POST /me/feedback`.
   - **Expect**: `201` — Company Admin can submit feedback about their own canteen too (spec Assumptions), treated identically to any other role's submission.

## Scenario 2 — Company Admin reviews the queue (User Story 2)

1. As Company A's Company Admin, `GET /tenant/feedback`.
   - **Expect**: `200`; a list containing exactly the records from Scenario 1 (steps 1–3, 7), newest first, and nothing from any other company.
2. `GET /tenant/feedback?status=new`.
   - **Expect**: `200`; only `status: "new"` records (all of them, at this point).
3. `GET /tenant/feedback/{id}` for the record submitted with `contact_requested: true` (Scenario 1 step 3).
   - **Expect**: `200`; response includes `contact_email` equal to that Student's registered email (research.md §3).
4. `GET /tenant/feedback/{id}` for a record submitted **without** `contact_requested`.
   - **Expect**: `200`; `contact_email` is absent or `null`.
5. As a Company Staff account (not Company Admin) in Company A, `GET /tenant/feedback`.
   - **Expect**: `403` — the review queue is Company-Admin-only (spec Assumptions, FR-010).
6. As Company B's Company Admin, `GET /tenant/feedback`.
   - **Expect**: `200`; an empty list (or only Company B's own records) — none of Company A's feedback is visible (FR-015).
7. As Company B's Company Admin, `GET /tenant/feedback/{id}` using a Company A feedback record's id directly.
   - **Expect**: `404` — not merely hidden from listings, but unreachable by direct reference too (FR-015, Edge Cases).

## Scenario 3 — Company Admin resolves feedback (User Story 3)

1. As Company A's Company Admin, `PATCH /tenant/feedback/{id}/resolve` on a `new` record.
   - **Expect**: `200`; `status: "resolved"` in the response.
2. `GET /tenant/feedback?status=new` again.
   - **Expect**: `200`; the just-resolved record no longer appears.
3. `GET /tenant/feedback?status=resolved`.
   - **Expect**: `200`; the record appears here instead.
4. `PATCH /tenant/feedback/{id}/resolve` again on the same, already-resolved record.
   - **Expect**: `200`, `status` still `"resolved"` — a harmless no-op, not an error (research.md §5).
5. As the Student who originally submitted that record, attempt `PATCH /tenant/feedback/{id}/resolve`.
   - **Expect**: `403` — only Company Admin may change status (FR-014).
6. As Company B's Company Admin, attempt `PATCH /tenant/feedback/{id}/resolve` on Company A's record id.
   - **Expect**: `404` (FR-015).

## Pass/Fail

Any deviation is a blocking failure and must not ship — especially: a feedback record ever appearing under, or being resolvable by, a company other than the submitter's own (Scenario 2 steps 6–7, Scenario 3 step 6 — this is the platform's single biggest named risk per BRD §9); Company Staff reaching the review queue (Scenario 2 step 5); or a rejected submission (Scenario 1 steps 4–6) nonetheless creating a row.
