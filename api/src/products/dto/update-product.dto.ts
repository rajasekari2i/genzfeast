import { IsBoolean, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

/** PATCH semantics (coding_standard.md §6, FR-007) — matches ProductUpdateRequest. */
export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  price?: number;

  @IsOptional()
  @IsBoolean()
  is_veg?: boolean;

  /**
   * Not in this DTO's original scope — the mobile Create/Edit form now
   * shows a Sold Out toggle directly (this task's own explicit ask), in
   * addition to the list screen's own dedicated toggle-soldout endpoint.
   */
  @IsOptional()
  @IsBoolean()
  is_soldout?: boolean;
}
