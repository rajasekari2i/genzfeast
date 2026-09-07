import { IsString, MinLength } from 'class-validator';

/** Matches contracts/openapi.yaml's MasterDataCreateRequest. */
export class CreateCategoryDto {
  @IsString()
  @MinLength(1)
  name!: string;
}
