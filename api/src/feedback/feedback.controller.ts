import { Body, Controller, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { CurrentTenantContext } from '../common/decorators/current-tenant-context.decorator';
import type { TenantContext } from '../common/prisma/tenant-prisma.service';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import type { FeedbackResponse } from './feedback.mapper';

/**
 * specs/016-feedback-management contracts/openapi.yaml — POST /me/feedback.
 * No `@Roles(...)` — every authenticated role may submit feedback about
 * their own canteen (FR-001); `company_id`/submitter always come from the
 * verified JWT via `ctx`, never the request body (FR-006).
 */
@Controller('me')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantContextInterceptor)
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post('feedback')
  create(@CurrentTenantContext() ctx: TenantContext, @Body() dto: CreateFeedbackDto): Promise<FeedbackResponse> {
    return this.feedbackService.create(ctx, dto);
  }
}
