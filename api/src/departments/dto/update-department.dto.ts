import { IsOptional, IsString, MinLength } from 'class-validator';

/** PATCH semantics (coding_standard.md §6) — matches MasterDataUpdateRequest. */
export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}
