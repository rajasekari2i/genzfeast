import { IsString, MinLength } from 'class-validator';

/** Matches contracts/openapi.yaml's MasterDataCreateRequest. */
export class CreateDepartmentDto {
  @IsString()
  @MinLength(1)
  name!: string;
}
