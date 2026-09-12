import { IsEmail, IsIn, IsOptional, IsString, IsUUID, Matches, MinLength } from 'class-validator';

/**
 * (specs/001-company-role-user-setup contracts/openapi.yaml
 * StudentRegisterRequest, FR-011) `company_id` isn't in that original
 * contract's schema, but is required in practice here — added for
 * consistency with the identical convention 002/003 already established for
 * every other unauthenticated `/auth/*` endpoint: supplied implicitly by the
 * submitting Company's branded app build.
 */
export class RegisterStudentDto {
  @IsString()
  @MinLength(1)
  name!: string;

  /** Mobile number (UI Design §4.1: numeric, 10 digits). */
  @IsString()
  @Matches(/^\d{10}$/, { message: 'username must be a 10-digit mobile number' })
  username!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsEmail()
  email!: string;

  @IsIn(['male', 'female', 'transgender'])
  gender!: 'male' | 'female' | 'transgender';

  @IsUUID()
  company_id!: string;

  @IsUUID()
  category_id!: string;

  @IsOptional()
  @IsUUID()
  department_id?: string;

  /**
   * specs/014-msg91-sms-otp-mobile-verification. Optional at the DTO layer
   * — only actually required/checked in AuthService.registerStudent when
   * MOBILE_VERIFICATION_REQUIRED=true (env-gated until MSG91/DLT template
   * approval completes), so registration keeps working exactly as before
   * while the flag is off.
   */
  @IsOptional()
  @IsString()
  @MinLength(1)
  mobile_verification_token?: string;
}
