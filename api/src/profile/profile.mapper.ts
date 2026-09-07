import type { Category, Company, Department, Role, User } from '@prisma/client';

/** Wire shape of contracts/openapi.yaml's Profile schema — which fields appear depends on role (FR-002). */
export interface ProfileResponse {
  name: string;
  username: string;
  email: string;
  role: string;
  category?: string | null;
  department?: string | null;
  company?: string | null;
}

type UserWithRelations = Pick<User, 'name' | 'username' | 'email'> & {
  role: Pick<Role, 'name'>;
  category?: Pick<Category, 'name'> | null;
  department?: Pick<Department, 'name'> | null;
  company?: Pick<Company, 'name'> | null;
};

export function toProfileResponse(user: UserWithRelations): ProfileResponse {
  const base = { name: user.name, username: user.username, email: user.email, role: user.role.name };

  if (user.role.name === 'student') {
    return { ...base, category: user.category?.name ?? null, department: user.department?.name ?? null };
  }
  if (user.role.name === 'company_admin' || user.role.name === 'company_staff') {
    return { ...base, company: user.company?.name ?? null };
  }
  // system_admin: nothing further (FR-002).
  return base;
}
