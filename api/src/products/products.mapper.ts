import type { Product } from '@prisma/client';

/** Wire shape of contracts/openapi.yaml's Product schema. */
export interface ProductResponse {
  id: string;
  company_id: string;
  name: string;
  description: string;
  image_url: string | null;
  price: number;
  is_veg: boolean;
  is_soldout: boolean;
  created_at: string;
  updated_at: string;
}

export function toProductResponse(product: Product): ProductResponse {
  return {
    id: product.id,
    company_id: product.companyId,
    name: product.name,
    description: product.description,
    image_url: product.imageUrl,
    price: product.price,
    is_veg: product.isVeg,
    is_soldout: product.isSoldout,
    created_at: product.createdAt.toISOString(),
    updated_at: product.updatedAt.toISOString(),
  };
}
