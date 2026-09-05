# Phase 1 Data Model: User Profile (View, Edit, Change Password)

**Feature**: `007-user-profile-management` | **Date**: 2026-09-05

No new tables and no migration (research.md §1). This feature reads and selectively writes existing columns on `users` (`001-company-role-user-setup`) and writes two new event types into `auth_audit_logs` (`002-registration-login-jwt-auth`).

## Reused: `users` columns (from `001`, no changes)

| Column | This feature's access |
|---|---|
| `name` | Read-only (FR-008) |
| `username` | Read-only (FR-003) |
| `email` | Read + write (FR-004, FR-006) |
| `category_id` | Read-only (FR-005) — Student only; `NULL`/absent for other roles |
| `department_id` | Read + write, Student only (FR-005); validated against the caller's own `company_id` (research.md §3) |
| `company_id` | Read-only, for display context (FR-002) — `NULL` for `system_admin` |
| `password_hash` | Write, via the existing verify-then-rehash flow already established in `002` (FR-009–FR-012) |
| `updated_by`, `updated_at` | Written on every successful edit/password change, same as every other feature |

## Reused, extended: `auth_audit_logs` (from `002`) — new `event_type` values

| `event_type` | Written when |
|---|---|
| `password_change_succeeded` | A `POST /me/change-password` call's current-password check and new/retype match both pass (FR-009) |
| `password_change_failed` | A `POST /me/change-password` call is rejected for a mismatched confirmation (FR-010) or an incorrect current password (FR-011) |

No changes to `auth_audit_logs`'s existing columns — `user_id`, `company_id`, `event_type`, `created_at` already accommodate these two new values without modification.

## Validation Rules Summary (from spec Functional Requirements)

| Rule | Source |
|---|---|
| Username and Name are always read-only, never writable by this feature | FR-003, FR-008 |
| Category is read-only once set at registration | FR-005 |
| Email must be validly formatted before saving | FR-006 |
| A rejected edit saves nothing (all-or-nothing) | FR-007 |
| Department (Student only) must belong to the caller's own Company | FR-005 (research.md §3) |
| New password and its confirmation must match before checking the current password | FR-010 |
| Current password must verify correctly before any change is applied | FR-011 |
| A successful password change revokes every other active session for that account | FR-012 (`002`'s revocation mechanics, research.md §2) |
| No user can view or edit another user's profile | FR-014 |

## State Transitions

This feature introduces no new state machine. It performs simple field updates on an existing `users` row (Email, Department, `password_hash`) and, on a successful password change, triggers the session-revocation behavior `002` already defines (`refresh_tokens.revoked_at` set for every row belonging to the account except the one identified per research.md §2).
