import { IsIn, IsOptional } from 'class-validator';
import type { OrdersView } from '../student-orders.service';

/** Matches contracts/openapi.yaml's GET /student/orders `view` query param (specs/008 research.md §1). */
export class ListOrdersQueryDto {
  @IsOptional()
  @IsIn(['upcoming', 'history'])
  view?: OrdersView;
}
