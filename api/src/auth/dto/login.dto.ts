import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

/**
 * (specs/002-registration-login-jwt-auth contracts/openapi.yaml LoginRequest)
 * `company_id` is required in practice for every role except `system_admin`
 * — enforced in AuthService, not here, since that requirement depends on
 * data (`username`'s resolved role) the DTO layer doesn't have (spec.md
 * Clarifications 2026-09-06).
 */
export class LoginDto {
  @IsString()
  @MinLength(1)
  username!: string;

  @IsString()
  @MinLength(1)
  password!: string;

  @IsOptional()
  @IsUUID()
  company_id?: string;
}
