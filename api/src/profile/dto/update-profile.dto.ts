import { IsEmail, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

/**
 * Matches contracts/openapi.yaml's ProfileUpdateRequest.
 *
 * `name` IS accepted (every role may correct their own display name).
 * `username` and `category_id` are still absent entirely — FR-005/FR-008
 * keep those permanently read-only, so there is nothing for the DTO to even
 * reject; the global ValidationPipe's `forbidNonWhitelisted` rejects any
 * such field a client tries to send. Username in particular is the login
 * identifier and is unique per tenant, so letting a user change it here
 * would need a uniqueness check and a session story this endpoint does not
 * have.
 *
 * MinLength(1) mirrors UpdateTenantUserDto's own `name` rule, so a user
 * editing their own name and an admin editing it for them are validated
 * identically.
 */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  /** Student only — enforced in ProfileService, not here (needs the caller's role). */
  @IsOptional()
  @IsUUID()
  department_id?: string;
}
