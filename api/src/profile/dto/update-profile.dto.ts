import { IsEmail, IsOptional, IsUUID } from 'class-validator';

/**
 * Matches contracts/openapi.yaml's ProfileUpdateRequest. Deliberately has no
 * `name`/`username`/`category_id` fields at all — FR-003/FR-005/FR-008 make
 * those permanently read-only, so there's nothing for the DTO to even
 * reject; the global ValidationPipe's `forbidNonWhitelisted` does that job
 * automatically for any such field a client tries to send.
 */
export class UpdateProfileDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  /** Student only — enforced in ProfileService, not here (needs the caller's role). */
  @IsOptional()
  @IsUUID()
  department_id?: string;
}
