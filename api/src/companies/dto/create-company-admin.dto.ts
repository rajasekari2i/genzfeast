import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

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
}
