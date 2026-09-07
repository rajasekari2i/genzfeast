import { IsEmail, IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

/**
 * PATCH semantics (coding_standard.md §6) — every field optional, only
 * submitted fields change. CreateTenantUserDto's own field set, all made
 * optional; `password` omitted means "keep the existing one". Unlike
 * creation, a student's `category_id` isn't force-required here — editing
 * an existing row never needs to re-supply a value that's already set, and
 * this endpoint has no way to know the resulting role without re-deriving
 * it, so that check stays create-only (mirrors this task's own System Admin
 * equivalent, UpdateAdminUserDto, which has the same boundary).
 */
export class UpdateTenantUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  /** Mobile number, per CreateTenantUserDto's own field description. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  username?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsIn(['male', 'female', 'transgender'])
  gender?: 'male' | 'female' | 'transgender';

  @IsOptional()
  @IsIn(['company_staff', 'student', 'teaching', 'non_teaching'])
  role?: 'company_staff' | 'student' | 'teaching' | 'non_teaching';

  @IsOptional()
  @IsUUID()
  category_id?: string;

  @IsOptional()
  @IsUUID()
  department_id?: string;
}
