import { IsEmail, IsIn, IsNotEmpty, IsString, MinLength } from 'class-validator';

/** Matches contracts/openapi.yaml's AdminUserCreateRequest. */
export class CreateCompanyAdminDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  /** The student/staff mobile number, per the contract's own field description. */
  @IsString()
  @IsNotEmpty()
  username!: string;

  /** A temporary password the Company Admin is expected to change on first login (out of this feature's scope). */
  @IsString()
  @MinLength(8)
  password!: string;

  @IsEmail()
  email!: string;

  /**
   * Required for the same reason CreateAdminUserDto/CreateTenantUserDto
   * require it: `users.gender` is nullable only because rows predating
   * migration 20260908090000_user_gender exist, and every creation path
   * going forward collects it. This endpoint was the last one that didn't.
   */
  @IsIn(['male', 'female', 'other'])
  gender!: 'male' | 'female' | 'other';
}
