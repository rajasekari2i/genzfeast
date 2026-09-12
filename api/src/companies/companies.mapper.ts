import type { Company, User } from '@prisma/client';

/** Wire shape of contracts/openapi.yaml's Company schema. */
export interface CompanyResponse {
  id: string;
  name: string;
  contact_person: string;
  mobile: string;
  email: string;
  address: string;
  is_open: boolean;
  is_sms: boolean;
  created_at: string;
  updated_at: string;
}

/** Wire shape of contracts/openapi.yaml's User schema. */
export interface UserResponse {
  id: string;
  company_id: string | null;
  role: string;
  name: string;
  username: string;
  email: string;
  gender: string | null;
  category_id: string | null;
  department_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

/** Prisma's camelCase Company -> contracts/openapi.yaml's snake_case Company response shape. */
export function toCompanyResponse(company: Company): CompanyResponse {
  return {
    id: company.id,
    name: company.name,
    contact_person: company.contactPerson,
    mobile: company.mobile,
    email: company.email,
    address: company.address,
    is_open: company.isOpen,
    is_sms: company.isSms,
    created_at: company.createdAt.toISOString(),
    updated_at: company.updatedAt.toISOString(),
  };
}

/**
 * Prisma's camelCase User -> contracts/openapi.yaml's snake_case User
 * response shape. `roleName` is passed separately since User itself only
 * stores roleId. Accepts a narrowed projection (coding_standard.md §4.4 —
 * callers `select` only the columns they need, e.g. never `passwordHash`),
 * not the full `User` model.
 */
export function toUserResponse(
  user: Pick<
    User,
    | 'id'
    | 'companyId'
    | 'name'
    | 'username'
    | 'email'
    | 'gender'
    | 'categoryId'
    | 'departmentId'
    | 'status'
    | 'createdAt'
    | 'updatedAt'
  >,
  roleName: string,
): UserResponse {
  return {
    id: user.id,
    company_id: user.companyId,
    role: roleName,
    name: user.name,
    username: user.username,
    email: user.email,
    gender: user.gender,
    category_id: user.categoryId,
    department_id: user.departmentId,
    status: user.status,
    created_at: user.createdAt.toISOString(),
    updated_at: user.updatedAt.toISOString(),
  };
}
