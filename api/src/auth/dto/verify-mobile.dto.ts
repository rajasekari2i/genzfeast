import { IsString, IsUUID, Matches, MinLength } from 'class-validator';

/** (specs/014-msg91-sms-otp-mobile-verification) POST /auth/register/verify-mobile */
export class VerifyMobileDto {
  @IsUUID()
  company_id!: string;

  @IsString()
  @Matches(/^\d{10}$/, { message: 'mobile_number must be a 10-digit mobile number' })
  mobile_number!: string;

  @IsString()
  @MinLength(1)
  code!: string;
}
