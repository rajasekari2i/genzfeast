import { IsOptional, IsString, IsUUID, Matches } from 'class-validator';

/** (specs/014-msg91-sms-otp-mobile-verification) POST /auth/register/send-verification */
export class SendMobileVerificationDto {
  @IsUUID()
  company_id!: string;

  /** Mobile number (same shape as register-student.dto.ts's username: numeric, 10 digits). */
  @IsString()
  @Matches(/^\d{10}$/, { message: 'mobile_number must be a 10-digit mobile number' })
  mobile_number!: string;

  /**
   * FR-007 — the registering device's own FCM token, best-effort supplied
   * by the mobile client. Optional: absent whenever push permission was
   * denied or Firebase isn't configured on-device, in which case an MSG91
   * failure has no fallback to attempt.
   */
  @IsOptional()
  @IsString()
  fcm_token?: string;
}
