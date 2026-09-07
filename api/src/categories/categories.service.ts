import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContext, TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { PaginatedResult, PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryResponse, toCategoryResponse } from './categories.mapper';

/**
 * specs/001-company-role-user-setup FR-006/FR-008. Every method is scoped to
 * `ctx.companyId` at the API layer (coding_standard.md's defense-in-depth
 * pair — RLS re-checks the same scoping independently via
 * categories_tenant_isolation). `ctx.companyId` is guaranteed present here:
 * every route this service backs is restricted (RolesGuard) to
 * company_admin/staff/student, all of which always carry a company_id claim.
 * `list` is server-side paginated (10 per page, fetch the next page on
 * scroll) with a name search filter, matching DepartmentsService.list's own
 * treatment.
 */
@Injectable()
export class CategoriesService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async list(ctx: TenantContext, query: PaginationQueryDto): Promise<PaginatedResult<CategoryResponse>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: Prisma.CategoryWhereInput = {
      companyId: ctx.companyId as string,
      isDeleted: false,
      ...(query.search && { name: { contains: query.search, mode: 'insensitive' } }),
    };

    const [categories, total] = await this.tenantPrisma.runInTenantContext(ctx, (tx) =>
      Promise.all([
        tx.category.findMany({
          where,
          orderBy: { name: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        tx.category.count({ where }),
      ]),
    );
    return { items: categories.map(toCategoryResponse), page, limit, total };
  }

  /**
   * Needed once `list` became paginated (10 per page) — the mobile edit
   * screen can't rely on "fetch the full list, find by id" to prefill its
   * form, since the category being edited may not be on page 1.
   */
  async findOne(ctx: TenantContext, categoryId: string): Promise<CategoryResponse> {
    const category = await this.tenantPrisma.runInTenantContext(ctx, (tx) =>
      tx.category.findFirst({
        where: { id: categoryId, companyId: ctx.companyId as string, isDeleted: false },
      }),
    );
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return toCategoryResponse(category);
  }

  async create(ctx: TenantContext, dto: CreateCategoryDto): Promise<CategoryResponse> {
    try {
      const category = await this.tenantPrisma.runInTenantContext(ctx, (tx) =>
        tx.category.create({
          data: { companyId: ctx.companyId as string, name: dto.name, createdBy: ctx.userId },
        }),
      );
      return toCategoryResponse(category);
    } catch (error) {
      // categories_company_name_unique (case-insensitive per company).
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A category with this name already exists');
      }
      throw error;
    }
  }

  async update(ctx: TenantContext, categoryId: string, dto: UpdateCategoryDto): Promise<CategoryResponse> {
    return this.tenantPrisma.runInTenantContext(ctx, async (tx) => {
      const existing = await tx.category.findFirst({
        where: { id: categoryId, companyId: ctx.companyId as string, isDeleted: false },
      });
      if (!existing) {
        throw new NotFoundException('Category not found');
      }
      try {
        const updated = await tx.category.update({
          where: { id: categoryId },
          data: { ...(dto.name !== undefined && { name: dto.name }), updatedBy: ctx.userId },
        });
        return toCategoryResponse(updated);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException('A category with this name already exists');
        }
        throw error;
      }
    });
  }

  /** FR-008: soft-delete only — never removes a row a Product/User may already reference. */
  async remove(ctx: TenantContext, categoryId: string): Promise<void> {
    await this.tenantPrisma.runInTenantContext(ctx, async (tx) => {
      const existing = await tx.category.findFirst({
        where: { id: categoryId, companyId: ctx.companyId as string, isDeleted: false },
      });
      if (!existing) {
        throw new NotFoundException('Category not found');
      }
      await tx.category.update({ where: { id: categoryId }, data: { isDeleted: true, updatedBy: ctx.userId } });
    });
  }
}
