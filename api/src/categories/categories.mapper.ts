import type { Category } from '@prisma/client';

/** Wire shape of contracts/openapi.yaml's Category schema. */
export interface CategoryResponse {
  id: string;
  company_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export function toCategoryResponse(
  category: Pick<Category, 'id' | 'companyId' | 'name' | 'createdAt' | 'updatedAt'>,
): CategoryResponse {
  return {
    id: category.id,
    company_id: category.companyId,
    name: category.name,
    created_at: category.createdAt.toISOString(),
    updated_at: category.updatedAt.toISOString(),
  };
}
