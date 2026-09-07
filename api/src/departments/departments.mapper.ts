import type { Department } from '@prisma/client';

/** Wire shape of contracts/openapi.yaml's Department schema. */
export interface DepartmentResponse {
  id: string;
  company_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export function toDepartmentResponse(
  department: Pick<Department, 'id' | 'companyId' | 'name' | 'createdAt' | 'updatedAt'>,
): DepartmentResponse {
  return {
    id: department.id,
    company_id: department.companyId,
    name: department.name,
    created_at: department.createdAt.toISOString(),
    updated_at: department.updatedAt.toISOString(),
  };
}
