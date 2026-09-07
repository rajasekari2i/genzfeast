import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

/** Matches contracts/openapi.yaml's PlaceOrderRequest.items entries. */
export class PlaceOrderItemDto {
  @IsUUID()
  product_id!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

/**
 * Matches contracts/openapi.yaml's PlaceOrderRequest. Deliberately carries
 * no price/name (research.md §2) — the server looks up each product_id's
 * current price/name/availability itself; the client's own displayed price
 * is never authoritative.
 */
export class PlaceOrderRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PlaceOrderItemDto)
  items!: PlaceOrderItemDto[];

  /** V1 has exactly one available value; accepted for forward compatibility (FR-007). */
  @IsOptional()
  @IsString()
  payment_method?: string;
}
