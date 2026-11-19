import { IsEmail, IsIn, IsString, IsUUID, Matches, MinLength } from 'class-validator';

/**
 * System Admin's cross-tenant equivalent of CreateTenantUserDto — the same
 * shape plus an explicit `company_id`, since the caller isn't scoped to any
 * one company (their JWT's company_id is null). Restricted to the same two
 * roles Company Admin may already grant via /tenant/users — creating a
 * Student here is explicitly out of scope (would need a Category picker
 * dependent on the selected Company; a separate decision, not built here).
 */
export class CreateAdminUserDto {
  @IsString()
  @MinLength(1)
  name!: string;

  /** Mobile number — see CreateTenantUserDto for why the shape is enforced. */
  @IsString()
  @Matches(/^\d{10}$/, { message: 'username must be a 10-digit mobile number' })
  username!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsEmail()
  email!: string;

  @IsIn(['male', 'female', 'other'])
  gender!: 'male' | 'female' | 'other';

  @IsIn(['company_staff', 'company_admin'])
  role!: 'company_staff' | 'company_admin';

  @IsUUID()
  company_id!: string;
}
