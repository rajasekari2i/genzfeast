import { IsBoolean, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

/** Matches contracts/openapi.yaml's ProductCreateRequest. */
export class CreateProductDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  description!: string;

  /** Whole-number amount in the smallest currency unit (FR-004/data-model.md). */
  @IsInt()
  @Min(1)
  price!: number;

  @IsBoolean()
  is_veg!: boolean;

  /** Optional; defaults to false per FR-005. */
  @IsOptional()
  @IsBoolean()
  is_soldout?: boolean;
}
