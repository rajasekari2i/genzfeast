import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContext, TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { PaginatedResult, PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ToggleSoldoutDto } from './dto/toggle-soldout.dto';
import { ProductResponse, toProductResponse } from './products.mapper';
import { ProductImageStoragePort } from './product-image-storage.port';

/**
 * specs/004-company-admin-product-crud. Every method is scoped to
 * `ctx.companyId` (RolesGuard restricts every route here to
 * company_admin/staff, both always company-scoped) — no system_admin
 * bypass anywhere in this module, per FR-003 (corrected).
 */
@Injectable()
export class ProductsService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly imageStorage: ProductImageStoragePort,
  ) {}

  /**
   * Server-side pagination (this task's own explicit ask: 10 per page,
   * fetch the next page on scroll) — `page`/`limit` default to 1/10 via
   * PaginationQueryDto itself. `search` filters by name, case-insensitive
   * substring, same as CompanyListScreen/UserListScreen's own search but
   * applied in the query instead of client-side, since the full list is no
   * longer fetched in one shot.
   */
  async list(ctx: TenantContext, query: PaginationQueryDto): Promise<PaginatedResult<ProductResponse>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: Prisma.ProductWhereInput = {
      companyId: ctx.companyId as string,
      isDeleted: false,
      ...(query.search && { name: { contains: query.search, mode: 'insensitive' } }),
    };

    const [products, total] = await this.tenantPrisma.runInTenantContext(ctx, (tx) =>
      Promise.all([
        tx.product.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        tx.product.count({ where }),
      ]),
    );
    return { items: products.map(toProductResponse), page, limit, total };
  }

  /**
   * Needed once `list` became paginated (10 per page) — the mobile edit
   * screen can no longer rely on "fetch the full list, find by id" to
   * prefill its form, since the product being edited may not be on page 1.
   */
  async findOne(ctx: TenantContext, productId: string): Promise<ProductResponse> {
    const product = await this.tenantPrisma.runInTenantContext(ctx, (tx) =>
      this.findActiveOrThrow(tx, ctx, productId),
    );
    return toProductResponse(product);
  }

  async create(ctx: TenantContext, dto: CreateProductDto): Promise<ProductResponse> {
    const product = await this.tenantPrisma.runInTenantContext(ctx, (tx) =>
      tx.product.create({
        data: {
          companyId: ctx.companyId as string,
          name: dto.name,
          description: dto.description,
          price: dto.price,
          isVeg: dto.is_veg,
          isSoldout: dto.is_soldout ?? false,
          createdBy: ctx.userId,
        },
      }),
    );
    return toProductResponse(product);
  }

  async update(ctx: TenantContext, productId: string, dto: UpdateProductDto): Promise<ProductResponse> {
    return this.tenantPrisma.runInTenantContext(ctx, async (tx) => {
      const existing = await this.findActiveOrThrow(tx, ctx, productId);
      const updated = await tx.product.update({
        where: { id: existing.id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.price !== undefined && { price: dto.price }),
          ...(dto.is_veg !== undefined && { isVeg: dto.is_veg }),
          ...(dto.is_soldout !== undefined && { isSoldout: dto.is_soldout }),
          updatedBy: ctx.userId,
        },
      });
      return toProductResponse(updated);
    });
  }

  /** FR-006/FR-012: a distinct write path from full edit, shared with Staff. */
  async toggleSoldout(ctx: TenantContext, productId: string, dto: ToggleSoldoutDto): Promise<ProductResponse> {
    return this.tenantPrisma.runInTenantContext(ctx, async (tx) => {
      const existing = await this.findActiveOrThrow(tx, ctx, productId);
      const updated = await tx.product.update({
        where: { id: existing.id },
        data: { isSoldout: dto.is_soldout, updatedBy: ctx.userId },
      });
      return toProductResponse(updated);
    });
  }

  /** FR-008/FR-009: soft-delete only — the row/id remain valid for any existing reference. */
  async remove(ctx: TenantContext, productId: string): Promise<void> {
    await this.tenantPrisma.runInTenantContext(ctx, async (tx) => {
      const existing = await this.findActiveOrThrow(tx, ctx, productId);
      await tx.product.update({ where: { id: existing.id }, data: { isDeleted: true, updatedBy: ctx.userId } });
    });
  }

  /** FR-002: stores the photo via the injected port, persists only the resulting URL. */
  async uploadImage(
    ctx: TenantContext,
    productId: string,
    file: { buffer: Buffer; mimetype: string; originalname: string },
  ): Promise<ProductResponse> {
    return this.tenantPrisma.runInTenantContext(ctx, async (tx) => {
      const existing = await this.findActiveOrThrow(tx, ctx, productId);
      const imageUrl = await this.imageStorage.upload({
        companyId: existing.companyId,
        productId: existing.id,
        buffer: file.buffer,
        mimeType: file.mimetype,
        originalName: file.originalname,
      });
      const updated = await tx.product.update({
        where: { id: existing.id },
        data: { imageUrl, updatedBy: ctx.userId },
      });
      return toProductResponse(updated);
    });
  }

  private async findActiveOrThrow(tx: Prisma.TransactionClient, ctx: TenantContext, productId: string) {
    const existing = await tx.product.findFirst({
      where: { id: productId, companyId: ctx.companyId as string, isDeleted: false },
    });
    if (!existing) {
      throw new NotFoundException('Product not found');
    }
    return existing;
  }
}
