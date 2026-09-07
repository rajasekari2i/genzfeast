import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Shared offset-pagination query shape for a mobile list screen that fetches
 * page 1 on load/search-change and appends subsequent pages on scroll
 * (Products/Departments/Product Categories). `page` is 1-based; `limit`
 * defaults to 10 and caps at 50 so a client can't force an unbounded query.
 * `search` is an optional case-insensitive `name` substring filter, applied
 * by each service's own `where` clause (this DTO only carries the raw
 * value).
 */
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;
}

/**
 * Products has no veg/non-veg search filter in this feature's own scope —
 * only ProductCategoriesController's list needs this extra field.
 * Deliberately NOT `@Type(() => Boolean)` — class-transformer's Boolean
 * type coercion is a plain `Boolean(value)` call, which makes the query
 * string "false" coerce to `true` (any non-empty string is truthy). This
 * explicit string-literal Transform is the correct way to parse a
 * true/false query param.
 */
export class VegFilterPaginationQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  is_veg?: boolean;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}
