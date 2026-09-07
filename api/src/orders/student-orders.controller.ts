import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { CurrentTenantContext } from '../common/decorators/current-tenant-context.decorator';
import type { TenantContext } from '../common/prisma/tenant-prisma.service';
import { StudentOrdersService } from './student-orders.service';
import { PlaceOrderRequestDto } from './dto/place-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import type {
  OrderDetailResponse,
  OrderResponse,
  OrderWithPaymentSessionResponse,
  ProductForBrowsingResponse,
} from './student-orders.mapper';

/**
 * specs/006-student-browse-cart-checkout contracts/openapi.yaml —
 * /student/products, /student/orders*. `student` role only.
 */
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor)
@Roles('student')
export class StudentOrdersController {
  constructor(private readonly studentOrdersService: StudentOrdersService) {}

  @Get('student/products')
  listProducts(@CurrentTenantContext() ctx: TenantContext): Promise<ProductForBrowsingResponse[]> {
    return this.studentOrdersService.listProducts(ctx);
  }

  /** specs/008-my-orders-history-upcoming — `?view=upcoming|history` filters; omitted keeps 006's original unfiltered list. */
  @Get('student/orders')
  listOrders(
    @CurrentTenantContext() ctx: TenantContext,
    @Query() query: ListOrdersQueryDto,
  ): Promise<OrderResponse[]> {
    return this.studentOrdersService.listOrders(ctx, query.view);
  }

  /** 201 for a newly created order, 200 when an existing unresolved one was returned instead (FR-016). */
  @Post('student/orders')
  async placeOrder(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: PlaceOrderRequestDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OrderWithPaymentSessionResponse> {
    const { order, created } = await this.studentOrdersService.placeOrder(ctx, dto);
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return order;
  }

  @Get('student/orders/:orderId')
  getOrder(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ): Promise<OrderDetailResponse> {
    return this.studentOrdersService.getOrder(ctx, orderId);
  }

  @Post('student/orders/:orderId/retry-payment')
  @HttpCode(HttpStatus.OK)
  retryPayment(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ): Promise<OrderWithPaymentSessionResponse> {
    return this.studentOrdersService.retryPayment(ctx, orderId);
  }
}
