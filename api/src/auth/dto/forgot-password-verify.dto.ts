import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

/** (specs/003-forgot-password-otp-reset contracts/openapi.yaml VerifyRequest) */
export class ForgotPasswordVerifyDto {
  @IsString()
  @MinLength(1)
  username!: string;

  @IsOptional()
  @IsUUID()
  company_id?: string;

  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  new_password!: string;

  @IsString()
  @MinLength(1)
  retype_password!: string;
}
