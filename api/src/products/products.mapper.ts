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

/**
 * The list view's Product, which carries one field the single-product views
 * do not: how many of this item today's orders have already consumed.
 *
 * Deliberately a SEPARATE type rather than an optional field on
 * ProductResponse — create/update/findOne never run the aggregate, and an
 * optional `ordered_today` there would read as "zero ordered today" when it
 * actually means "not computed". A product that genuinely has no orders
 * today reports 0 from the list, which is a different claim.
 */
export interface ProductListItemResponse extends ProductResponse {
  ordered_today: number;
}

export function toProductListItemResponse(product: Product, orderedToday: number): ProductListItemResponse {
  return { ...toProductResponse(product), ordered_today: orderedToday };
}
