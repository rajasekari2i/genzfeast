import { IsOptional, IsString, MinLength } from 'class-validator';

/** Matches contracts/openapi.yaml's ChangePasswordRequest. */
export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  current_password!: string;

  @IsString()
  @MinLength(8)
  new_password!: string;

  @IsString()
  @MinLength(1)
  retype_password!: string;

  /**
   * Optional — the caller's own current-session refresh token, so that one
   * session is spared from revocation (research.md §2, the same pattern
   * 002's /auth/logout already uses). Omitted => every session, including
   * the current one, is revoked.
   */
  @IsOptional()
  @IsString()
  refresh_token?: string;
}
