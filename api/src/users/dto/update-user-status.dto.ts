import { IsIn } from 'class-validator';

/** Matches contracts/openapi.yaml's /tenant/users/{userId}/status body. */
export class UpdateUserStatusDto {
  @IsIn(['active', 'inactive'])
  status!: 'active' | 'inactive';
}
