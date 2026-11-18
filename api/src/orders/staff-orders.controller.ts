import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { CurrentTenantContext } from '../common/decorators/current-tenant-context.decorator';
import type { TenantContext } from '../common/prisma/tenant-prisma.service';
import { StaffOrdersService, VerifySuccessResponse } from './staff-orders.service';
import { VerifyOrderCodeDto } from './dto/verify-order-code.dto';
import type {
  StaffOrderDetailResponse,
  StaffOrderHistoryResponse,
  StaffOrderSummaryResponse,
} from './staff-orders.mapper';
import type { MarkReadyResponse } from './staff-orders.service';
import { PaginatedResult, PaginationQueryDto } from '../common/dto/pagination-query.dto';

/**
 * specs/005-staff-order-fulfilment-otp contracts/openapi.yaml —
 * /tenant/staff/orders.
 *
 * Opened to company_admin as well as company_staff, revising the contract's
 * original "restricted to the staff role". A canteen often runs with a
 * single staff account, and when that person is away nobody could hand an
 * order over; the Company Admin is the account that exists at every tenant,
 * so it is the fallback. The route PREFIX stays `/tenant/staff/orders` —
 * renaming it would break every deployed build for a label.
 *
 * The matching RLS change is migration 20261118000000_admin_order_fulfilment
 * (`tenant_deliver_own_company_orders`). Both layers are required: this
 * decorator alone would hand an admin a screen whose "mark delivered"
 * fails at the database, since the UPDATE policy named company_staff only.
 */
@Controller('tenant/staff/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor)
@Roles('company_staff', 'company_admin')
export class StaffOrdersController {
  constructor(private readonly staffOrdersService: StaffOrdersService) {}

  @Get()
  listIncoming(@CurrentTenantContext() ctx: TenantContext): Promise<StaffOrderSummaryResponse[]> {
    return this.staffOrdersService.listIncoming(ctx);
  }

  /**
   * MUST stay above @Get(':orderId'). Nest matches in declaration order, so
   * the param route would otherwise swallow "history" and ParseUUIDPipe
   * would reject it as a malformed id — a 400 that looks like a client bug.
   */
  @Get('history')
  listHistory(
    @CurrentTenantContext() ctx: TenantContext,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<StaffOrderHistoryResponse>> {
    return this.staffOrdersService.listHistory(ctx, query);
  }

  @Get(':orderId')
  getDetail(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ): Promise<StaffOrderDetailResponse> {
    return this.staffOrdersService.getDetail(ctx, orderId);
  }

  /**
   * order_placed -> order_ready, announcing it to the diner. Separate from
   * /verify on purpose: this one is safe to expose on the list row (it
   * takes no secret and cannot hand food to the wrong person), while
   * /verify consumes the pickup code.
   */
  @Post(':orderId/ready')
  @HttpCode(HttpStatus.OK)
  markReady(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ): Promise<MarkReadyResponse> {
    return this.staffOrdersService.markReady(ctx, orderId);
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
