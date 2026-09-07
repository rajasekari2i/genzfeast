import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContext, TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { PaginatedResult, PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { DepartmentResponse, toDepartmentResponse } from './departments.mapper';

/**
 * specs/001-company-role-user-setup FR-007/FR-008 — mirrors CategoriesService
 * except `list`, which was later given server-side pagination (this task's
 * own explicit ask: 10 per page, fetch the next page on scroll) plus a name
 * search filter, matching ProductsService.list's own treatment.
 */
@Injectable()
export class DepartmentsService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async list(ctx: TenantContext, query: PaginationQueryDto): Promise<PaginatedResult<DepartmentResponse>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: Prisma.DepartmentWhereInput = {
      companyId: ctx.companyId as string,
      isDeleted: false,
      ...(query.search && { name: { contains: query.search, mode: 'insensitive' } }),
    };

    const [departments, total] = await this.tenantPrisma.runInTenantContext(ctx, (tx) =>
      Promise.all([
        tx.department.findMany({
          where,
          orderBy: { name: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        tx.department.count({ where }),
      ]),
    );
    return { items: departments.map(toDepartmentResponse), page, limit, total };
  }

  /**
   * Needed once `list` became paginated (10 per page) — the mobile edit
   * screen can no longer rely on "fetch the full list, find by id" to
   * prefill its form, since the department being edited may not be on page 1.
   */
  async findOne(ctx: TenantContext, departmentId: string): Promise<DepartmentResponse> {
    const department = await this.tenantPrisma.runInTenantContext(ctx, (tx) =>
      tx.department.findFirst({
        where: { id: departmentId, companyId: ctx.companyId as string, isDeleted: false },
      }),
    );
    if (!department) {
      throw new NotFoundException('Department not found');
    }
    return toDepartmentResponse(department);
  }

  async create(ctx: TenantContext, dto: CreateDepartmentDto): Promise<DepartmentResponse> {
    try {
      const department = await this.tenantPrisma.runInTenantContext(ctx, (tx) =>
        tx.department.create({
          data: { companyId: ctx.companyId as string, name: dto.name, createdBy: ctx.userId },
        }),
      );
      return toDepartmentResponse(department);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A department with this name already exists');
      }
      throw error;
    }
  }

  async update(ctx: TenantContext, departmentId: string, dto: UpdateDepartmentDto): Promise<DepartmentResponse> {
    return this.tenantPrisma.runInTenantContext(ctx, async (tx) => {
      const existing = await tx.department.findFirst({
        where: { id: departmentId, companyId: ctx.companyId as string, isDeleted: false },
      });
      if (!existing) {
        throw new NotFoundException('Department not found');
      }
      try {
        const updated = await tx.department.update({
          where: { id: departmentId },
          data: { ...(dto.name !== undefined && { name: dto.name }), updatedBy: ctx.userId },
        });
        return toDepartmentResponse(updated);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException('A department with this name already exists');
        }
        throw error;
      }
    });
  }

  /** FR-008: soft-delete only. */
  async remove(ctx: TenantContext, departmentId: string): Promise<void> {
    await this.tenantPrisma.runInTenantContext(ctx, async (tx) => {
      const existing = await tx.department.findFirst({
        where: { id: departmentId, companyId: ctx.companyId as string, isDeleted: false },
      });
      if (!existing) {
        throw new NotFoundException('Department not found');
      }
      await tx.department.update({ where: { id: departmentId }, data: { isDeleted: true, updatedBy: ctx.userId } });
    });
  }
}
