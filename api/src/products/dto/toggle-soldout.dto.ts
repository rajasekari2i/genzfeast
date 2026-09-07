import { IsBoolean } from 'class-validator';

/** Matches contracts/openapi.yaml's /tenant/products/{id}/soldout body. */
export class ToggleSoldoutDto {
  @IsBoolean()
  is_soldout!: boolean;
}
