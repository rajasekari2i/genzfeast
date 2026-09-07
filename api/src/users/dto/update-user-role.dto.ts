import { IsIn } from 'class-validator';

/**
 * Not in contracts/openapi.yaml's original scope — added per this task's
 * explicit ask for a "change user role" capability. Restricted the same way
 * CreateTenantUserDto is (revised scope): only ever reassigns among the
 * tenant-manageable roles (company_admin was dropped from this screen).
 */
export class UpdateUserRoleDto {
  @IsIn(['company_staff', 'student', 'teaching', 'non_teaching'])
  role!: 'company_staff' | 'student' | 'teaching' | 'non_teaching';
}
