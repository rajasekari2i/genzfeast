import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { CurrentTenantContext } from '../common/decorators/current-tenant-context.decorator';
import type { TenantContext } from '../common/prisma/tenant-prisma.service';
import { StaffOrdersService, VerifySuccessResponse } from './staff-orders.service';
import { VerifyOrderCodeDto } from './dto/verify-order-code.dto';
import type { StaffOrderDetailResponse, StaffOrderSummaryResponse } from './staff-orders.mapper';

/**
 * specs/005-staff-order-fulfilment-otp contracts/openapi.yaml —
 * /tenant/staff/orders. Every route is `staff` only, per the contract's own
 * description ("restricted to the staff role") — not company_admin, unlike
 * specs/004's Products endpoints.
 */
@Controller('tenant/staff/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor)
@Roles('company_staff')
export class StaffOrdersController {
  constructor(private readonly staffOrdersService: StaffOrdersService) {}

  @Get()
  listIncoming(@CurrentTenantContext() ctx: TenantContext): Promise<StaffOrderSummaryResponse[]> {
    return this.staffOrdersService.listIncoming(ctx);
  }

  @Get(':orderId')
  getDetail(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ): Promise<StaffOrderDetailResponse> {
    return this.staffOrdersService.getDetail(ctx, orderId);
  }

  @Post(':orderId/verify')
  @HttpCode(HttpStatus.OK)
  verify(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: VerifyOrderCodeDto,
  ): Promise<VerifySuccessResponse> {
    return this.staffOrdersService.verify(ctx, orderId, dto);
  }
}
