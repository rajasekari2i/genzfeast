import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

/**
 * (specs/003-forgot-password-otp-reset contracts/openapi.yaml
 * ForgotPasswordRequest) `company_id` follows the exact same convention as
 * 002's LoginDto — required in practice for every role except system_admin,
 * enforced in AuthService where the resolved account's role is known
 * (spec.md Clarifications 2026-09-06). `fcm_token` is FR-017 — optional;
 * when present, registers the device via DevicesService.upsertUnauthenticated
 * (see AuthService.requestPasswordReset).
 */
export class ForgotPasswordRequestDto {
  @IsString()
  @MinLength(1)
  username!: string;

  @IsOptional()
  @IsUUID()
  company_id?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  fcm_token?: string;
}
