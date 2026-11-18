import Config from 'react-native-config';

// Per-tenant company_id, supplied implicitly by each Company's branded app
// build (specs/002-registration-login-jwt-auth's LoginRequest.company_id
// convention, reused as-is by specs/003's forgot-password endpoints — see
// each spec's Clarifications 2026-09-06). Build-time only, like
// API_BASE_URL in ../api/client.ts — never hardcoded per coding_standard.md
// §10. Undefined for the (not-yet-built) system_admin surface, which has no
// Company.
export function getBuildCompanyId(): string | undefined {
  return Config.COMPANY_ID || undefined;
}

// Razorpay's key_id (not the secret — key_id is meant to be embedded
// client-side, per Razorpay's own checkout integration docs) — the
// counterpart to api/.env's RAZORPAY_KEY_ID, needed by CartScreen to open
// the Razorpay Checkout SDK (specs/006 research.md §4).
export function getRazorpayKeyId(): string | undefined {
  return Config.RAZORPAY_KEY_ID || undefined;
}

// Razorpay Dashboard > Settings > Payment Methods > Configuration — a saved
// set of enabled methods (BRD/PRD V1 scope: UPI-only). Checkout-time only;
// the backend (RazorpayService.createOrder) never needs this.
export function getRazorpayConfigId(): string | undefined {
  return Config.RAZORPAY_CONFIG_ID || undefined;
}

// The canteen's display name for this branded build — specs/017-ui-refresh
// FR-027, which requires every side menu to show the user's name and their
// canteen, and never their role.
//
// Build-time only, exactly like COMPANY_ID above. Deliberately NOT fetched:
// the drawer currently issues no request, and adding one to render a label
// would be a behavioural change this feature forbids (FR-032). A build that
// does not set it simply omits the line.
export function getTenantDisplayName(): string | undefined {
  return Config.APP_DISPLAY_NAME || undefined;
}

/**
 * The flat processing fee shown in the cart, in paise — the client-side
 * counterpart to api/.env's ORDER_PROCESSING_FEE_PAISE.
 *
 * DISPLAY ONLY. The server adds the fee itself when it builds the order and
 * is the sole authority on what the diner is charged, exactly as it is for
 * product prices. This copy exists so the cart can show the line before an
 * order exists to read it from.
 *
 * That makes the two values capable of disagreeing: this one is baked into
 * the APK at build time, so changing the server's fee does not change what
 * an already-installed app displays until it is rebuilt (the COMPANY_ID
 * trap). CartScreen therefore treats the server's total as truth the moment
 * it has one, and the order's own `processing_fee` — not this value — is
 * what the receipt renders.
 *
 * Unset or unparseable reads as 0, which hides the line entirely.
 */
export function getProcessingFeePaise(): number {
  const parsed = Number.parseInt(Config.PROCESSING_FEE_PAISE ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
