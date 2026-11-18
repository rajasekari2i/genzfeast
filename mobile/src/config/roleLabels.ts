/**
 * Human-readable names for the role strings the API returns.
 *
 * Lives here rather than in a screen because two surfaces now show a role to
 * the user — Profile's role tag and the Incoming orders header — and a role
 * that reads "Company Admin" on one screen and "company_admin" on the other
 * is the kind of drift that only gets noticed in a screenshot.
 *
 * The raw value is never shown: "company_admin" is a permission-system
 * string and reads as debug output.
 */
const ROLE_LABELS: Record<string, string> = {
  student: 'Student',
  company_admin: 'Company Admin',
  company_staff: 'Staff',
  system_admin: 'System Admin',
  teaching: 'Teaching Staff',
  non_teaching: 'Non-Teaching Staff',
};

/**
 * Unknown roles fall back to a title-cased form rather than disappearing, so
 * a role added to the backend still renders something sensible here.
 */
export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
