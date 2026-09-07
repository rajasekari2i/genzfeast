import { IsEmail, IsIn, IsOptional, IsString, IsUUID, MinLength, ValidateIf } from 'class-validator';

/**
 * Matches contracts/openapi.yaml's TenantUserCreateRequest (specs/001
 * FR-009/FR-018/FR-019, revised) — `role` now covers every role a Company
 * Admin may grant through this one screen: company_staff, student,
 * teaching, non_teaching. company_admin is deliberately excluded (dropped
 * from this screen per this task's own explicit scoping choice — creating a
 * peer admin isn't available here); system_admin stays excluded too
 * (platform-wide, not tenant-scoped). `category_id` is required exactly
 * when role is 'student' (mirrors RegisterStudentDto's own requirement —
 * every student row needs one); `department_id` stays optional for a
 * student and is ignored for every other role.
 */
export class CreateTenantUserDto {
  @IsString()
  @MinLength(1)
  name!: string;

  /** Mobile number, per the contract's own field description. */
  @IsString()
  @MinLength(1)
  username!: string;

  /** A temporary password the new user is expected to change (out of this feature's scope). */
  @IsString()
  @MinLength(8)
  password!: string;

  @IsEmail()
  email!: string;

  @IsIn(['male', 'female', 'transgender'])
  gender!: 'male' | 'female' | 'transgender';

  @IsIn(['company_staff', 'student', 'teaching', 'non_teaching'])
  role!: 'company_staff' | 'student' | 'teaching' | 'non_teaching';

  @ValidateIf((dto) => dto.role === 'student')
  @IsUUID()
  category_id?: string;

  @IsOptional()
  @IsUUID()
  department_id?: string;
}
