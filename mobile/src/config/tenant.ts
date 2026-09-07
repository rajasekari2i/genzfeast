// Per-tenant company_id, supplied implicitly by each Company's branded app
// build (specs/002-registration-login-jwt-auth's LoginRequest.company_id
// convention, reused as-is by specs/003's forgot-password endpoints — see
// each spec's Clarifications 2026-09-06). Build-time only, like
// EXPO_PUBLIC_API_BASE_URL in ../api/client.ts — never hardcoded
// per coding_standard.md §10. Undefined for the (not-yet-built) system_admin
// surface, which has no Company.
export function getBuildCompanyId(): string | undefined {
  return process.env.EXPO_PUBLIC_COMPANY_ID || undefined;
}

// Razorpay's key_id (not the secret — key_id is meant to be embedded
// client-side, per Razorpay's own checkout integration docs) — the
// counterpart to api/.env's RAZORPAY_KEY_ID, needed by CartScreen to open
// the Razorpay Checkout SDK (specs/006 research.md §4).
export function getRazorpayKeyId(): string | undefined {
  return process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || undefined;
}
