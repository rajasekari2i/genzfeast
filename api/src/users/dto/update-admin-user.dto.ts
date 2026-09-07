import { IsEmail, IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

/**
 * PATCH semantics (coding_standard.md §6): every field optional, only
 * submitted fields change. System Admin's cross-tenant edit of a
 * company_staff/company_admin account — CreateAdminUserDto's own field set,
 * all made optional. `password` left blank means "keep the existing one";
 * a caller wanting to change it submits a new one (min 8 characters, same
 * as creation).
 */
export class UpdateAdminUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  /** Mobile number, per CreateAdminUserDto's own field description. */
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
  @IsIn(['company_staff', 'company_admin'])
  role?: 'company_staff' | 'company_admin';

  @IsOptional()
  @IsUUID()
  company_id?: string;
}
