import { z } from 'zod';

// coding_standard.md §10: secrets/config come from env vars validated at
// boot via a typed schema — a missing required var fails startup
// immediately, never falls back to a default. Note DATABASE_URL is
// deliberately NOT part of this schema: the running application only ever
// connects as the non-superuser app_user role (APP_DATABASE_URL) —
// DATABASE_URL is a migration-time/CLI-only credential, never read by the
// app itself (coding_standard.md §4.3, §5).
const envSchema = z.object({
  APP_DATABASE_URL: z.string().min(1, 'APP_DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(1800),
  // specs/002-registration-login-jwt-auth spec.md Assumption "Credential
  // lifetimes" / FR-012.
  JWT_REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(14),
  ACCOUNT_LOCK_THRESHOLD: z.coerce.number().int().positive().default(5),
  // specs/003-forgot-password-otp-reset spec.md Assumptions.
  RESET_PASSWORD_OTP_TTL_MINUTES: z.coerce.number().int().positive().default(10),
  RESET_PASSWORD_OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  // specs/004-company-admin-product-crud research.md §1 (Architecture §1's
  // own Supabase Storage decision). Deliberately optional, unlike every
  // other var here: the app must still boot without Storage configured —
  // ProductsModule's image-upload path fails clearly at request time
  // instead (see ProductImageStoragePort), not at startup. No bucket-name
  // var — one bucket per Company, named by its company_id, created
  // on-demand (see ProductImageStoragePort.ensureBucketExists).
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  // Firebase Admin SDK service-account credentials (specs/003 FR-003,
  // specs/009 research.md §7) — for sending the forgot-password OTP as an
  // FCM data-message push. Deliberately optional, same reasoning as the
  // Supabase vars above: the app must still boot without Firebase
  // configured; NotificationsModule's factory provider falls back to a
  // logging no-op adapter (see fcm-notification.adapter.ts) whenever any of
  // these three are missing, rather than failing startup.
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  // Copy the service-account JSON's "private_key" value verbatim, including
  // its literal "\n" sequences — firebase-admin's cert() expects the real
  // newlines, so this is unescaped at read time (see fcm-notification.adapter.ts).
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  // Razorpay (specs/006 research.md §4, Architecture §7's "critical design
  // rule": only the webhook, never a client redirect, finalizes payment).
  // Deliberately optional, same reasoning as Supabase/Firebase above — the
  // app boots without these; only the order-placement/retry/webhook
  // endpoints fail clearly until they're set (see razorpay.service.ts).
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  // specs/014-msg91-sms-otp-mobile-verification — MSG91 SMS, used ONLY for
  // registration-time mobile-number verification (password-reset/
  // order-pickup OTPs stay on FCM above). Deliberately optional, same
  // reasoning as Firebase/Supabase/Razorpay: the app boots without these;
  // AuthService.sendMobileVerification throws a clear error at request
  // time instead (see msg91-sms.adapter.ts) — there's no silent-fallback
  // adapter for this one flow (unlike the FCM-based NotificationPort),
  // since a send failure here must be surfaced, not swallowed.
  MSG91_AUTH_KEY: z.string().optional(),
  MSG91_SENDER_ID: z.string().optional(),
  MSG91_DLT_ENTITY_ID: z.string().optional(),
  MSG91_TEMPLATE_ID_MOBILE_VERIFICATION: z.string().optional(),
  MOBILE_VERIFICATION_OTP_TTL_MINUTES: z.coerce.number().int().positive().default(10),
  MOBILE_VERIFICATION_OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  // Gates whether registerStudent actually enforces the verification-token
  // check — default false so registration keeps working exactly as before
  // until MSG91/DLT is live in a given environment.
  MOBILE_VERIFICATION_REQUIRED: z.coerce.boolean().default(false),
  // Resend-cooldown for the mobile-verification send endpoint only (real
  // SMS spend per call) — no throttling infrastructure exists in this
  // codebase, so this bounds spend per number without adding any.
  MOBILE_VERIFICATION_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(60),
  PORT: z.coerce.number().int().positive().default(3000),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
