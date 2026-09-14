import { Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { CurrentTenantContext } from '../common/decorators/current-tenant-context.decorator';
import type { TenantContext } from '../common/prisma/tenant-prisma.service';
import { FeedbackService } from './feedback.service';
import { ListFeedbackQueryDto } from './dto/list-feedback-query.dto';
import type { FeedbackDetailResponse, FeedbackResponse } from './feedback.mapper';

/**
 * specs/016-feedback-management contracts/openapi.yaml — /tenant/feedback....
 * Company-Admin-only throughout (FR-010, FR-013, FR-014) — unlike
 * `004`'s Products, Company Staff has no access to this review surface at
 * all (spec Assumptions), so every route here carries the same single-role
 * allowlist.
 */
@Controller('tenant/feedback')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor)
@Roles('company_admin')
export class TenantFeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Get()
  list(
    @CurrentTenantContext() ctx: TenantContext,
    @Query() query: ListFeedbackQueryDto,
  ): Promise<FeedbackResponse[]> {
    return this.feedbackService.list(ctx, query);
  }

  @Get(':feedbackId')
  findOne(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('feedbackId', ParseUUIDPipe) feedbackId: string,
  ): Promise<FeedbackDetailResponse> {
    return this.feedbackService.findOne(ctx, feedbackId);
  }

  /** One-way new -> resolved, no request body (research.md §5). */
  @Patch(':feedbackId/resolve')
  resolve(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('feedbackId', ParseUUIDPipe) feedbackId: string,
  ): Promise<FeedbackResponse> {
    return this.feedbackService.resolve(ctx, feedbackId);
  }
}
