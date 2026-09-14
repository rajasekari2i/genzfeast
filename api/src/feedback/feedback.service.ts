import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContext, TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { ListFeedbackQueryDto } from './dto/list-feedback-query.dto';
import { FeedbackStatus } from './feedback-category.constants';
import { FeedbackDetailResponse, FeedbackResponse, toDetailResponse, toResponse } from './feedback.mapper';

const SUBMITTER_SELECT = { id: true, name: true } as const;
const SUBMITTER_WITH_EMAIL_SELECT = { id: true, name: true, email: true } as const;

/**
 * specs/016-feedback-management. Every method runs through
 * `TenantPrismaService.runInTenantContext` (coding_standard.md §4.3) — RLS's
 * `feedback_tenant_isolation` policy independently re-checks the same
 * `company_id` scoping, so a bug here alone could never leak another
 * company's feedback (FR-015). Which *role* may call which method (any role
 * may create; only company_admin may list/view/resolve) is enforced by
 * `@Roles(...)` on the controller, not here — this module only ever needs
 * to answer "which company."
 */
@Injectable()
export class FeedbackService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async create(ctx: TenantContext, dto: CreateFeedbackDto): Promise<FeedbackResponse> {
    const feedback = await this.tenantPrisma.runInTenantContext(ctx, (tx) =>
      tx.feedback.create({
        data: {
          companyId: ctx.companyId as string,
          userId: ctx.userId as string,
          rating: dto.rating ?? null,
          category: dto.category,
          message: dto.message,
          contactRequested: dto.contact_requested ?? false,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        },
        include: { user: { select: SUBMITTER_SELECT } },
      }),
    );
    return toResponse(feedback);
  }

  /** Newest first (User Story 2, Acceptance Scenario 1), optional status filter (FR-011). */
  async list(ctx: TenantContext, query: ListFeedbackQueryDto): Promise<FeedbackResponse[]> {
    const where: Prisma.FeedbackWhereInput = {
      companyId: ctx.companyId as string,
      isDeleted: false,
      ...(query.status && { status: query.status }),
    };
    const feedback = await this.tenantPrisma.runInTenantContext(ctx, (tx) =>
      tx.feedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: SUBMITTER_SELECT } },
      }),
    );
    return feedback.map(toResponse);
  }

  /** research.md §3: contact_email is resolved here via the join, only ever exposed when contact_requested is true. */
  async findOne(ctx: TenantContext, feedbackId: string): Promise<FeedbackDetailResponse> {
    const feedback = await this.tenantPrisma.runInTenantContext(ctx, (tx) =>
      tx.feedback.findFirst({
        where: { id: feedbackId, companyId: ctx.companyId as string, isDeleted: false },
        include: { user: { select: SUBMITTER_WITH_EMAIL_SELECT } },
      }),
    );
    if (!feedback) {
      throw new NotFoundException('Feedback not found');
    }
    return toDetailResponse(feedback);
  }

  /** One-way new -> resolved; calling it again on an already-resolved record is a no-op success (research.md §5). */
  async resolve(ctx: TenantContext, feedbackId: string): Promise<FeedbackResponse> {
    return this.tenantPrisma.runInTenantContext(ctx, async (tx) => {
      const existing = await tx.feedback.findFirst({
        where: { id: feedbackId, companyId: ctx.companyId as string, isDeleted: false },
        include: { user: { select: SUBMITTER_SELECT } },
      });
      if (!existing) {
        throw new NotFoundException('Feedback not found');
      }
      if (existing.status === FeedbackStatus.Resolved) {
        return toResponse(existing);
      }
      const updated = await tx.feedback.update({
        where: { id: existing.id },
        data: { status: FeedbackStatus.Resolved, updatedBy: ctx.userId },
        include: { user: { select: SUBMITTER_SELECT } },
      });
      return toResponse(updated);
    });
  }
}
