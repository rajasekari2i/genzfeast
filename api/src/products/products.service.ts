import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContext, TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { PaginatedResult, PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ToggleSoldoutDto } from './dto/toggle-soldout.dto';
import {
  ProductListItemResponse,
  ProductResponse,
  toProductListItemResponse,
  toProductResponse,
} from './products.mapper';
import { ProductImageStoragePort } from './product-image-storage.port';

/**
 * The canteen's day, not the server's. `created_at` is timestamptz and the
 * API has no timezone config at all, so a naive `date_trunc('day', now())`
 * would roll the counter over at 05:30 IST and file a 23:00 order under the
 * next day. Hardcoded rather than env-driven because every tenant in V1 is
 * an Indian college campus; promote it to config the day that stops being
 * true.
 */
const DAY_BOUNDARY_TZ = 'Asia/Kolkata';

/**
 * Which orders consume stock. `payment_pending`/`payment_failed` are
 * excluded on purpose: an abandoned checkout has not eaten a biryani, and
 * counting it would push a product to sold-out while food is still on the
 * counter. `delivered` stays IN the count — the item left the kitchen, so
 * it is gone whether or not it has been handed over yet, and so does
 * `order_ready`, which is just `order_placed` further along the counter.
 */
const STOCK_CONSUMING_STATUSES = ['order_placed', 'order_ready', 'delivered'];

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
  async list(
    ctx: TenantContext,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<ProductListItemResponse>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: Prisma.ProductWhereInput = {
      companyId: ctx.companyId as string,
      isDeleted: false,
      ...(query.search && { name: { contains: query.search, mode: 'insensitive' } }),
    };

    const { products, total, orderedToday } = await this.tenantPrisma.runInTenantContext(ctx, async (tx) => {
      const [products, total] = await Promise.all([
        tx.product.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        tx.product.count({ where }),
      ]);
      // Inside the SAME tenant transaction as the page itself, so the
      // aggregate runs under the session variables RLS reads.
      const orderedToday = await this.countOrderedToday(
        tx,
        ctx,
        products.map((product) => product.id),
      );
      return { products, total, orderedToday };
    });

    return {
      items: products.map((product) => toProductListItemResponse(product, orderedToday.get(product.id) ?? 0)),
      page,
      limit,
      total,
    };
  }

  /**
   * How many units of each given product today's orders have already
   * consumed — the number the Products page shows beside the sold-out
   * toggle, so whoever is running the counter can see "47 of the 50
   * biryani are gone" instead of guessing.
   *
   * Has to be raw SQL: `orders.items` is a frozen JSONB snapshot, not an
   * `order_items` table, so there is no relation for Prisma to group by.
   * `jsonb_array_elements` unnests it and SUMs the per-line quantity.
   *
   * Scoped to the ids on the CURRENT PAGE (10 by default), not the whole
   * catalogue — one extra query per list load, bounded by page size.
   *
   * RLS: `staff_company_orders` grants SELECT on `orders` to both
   * company_admin and company_staff within their own company, so this
   * needs no bypass; the explicit `company_id` predicate below is the API
   * layer's own half of the two-layer rule, not a substitute for it.
   *
   * Returns a map so a product with no orders today is simply absent —
   * callers default it to 0.
   */
  private async countOrderedToday(
    tx: Prisma.TransactionClient,
    ctx: TenantContext,
    productIds: string[],
  ): Promise<Map<string, number>> {
    if (productIds.length === 0) return new Map();

    // `item->>'product_id'` is text, and so are the bound ids — comparing
    // them as text avoids a uuid cast on every unnested row.
    const rows = await tx.$queryRaw<Array<{ product_id: string; quantity: bigint }>>(Prisma.sql`
      SELECT item->>'product_id' AS product_id,
             SUM((item->>'quantity')::int) AS quantity
        FROM orders o,
             LATERAL jsonb_array_elements(o.items) AS item
       WHERE o.company_id = ${ctx.companyId}::uuid
         AND o.status IN (${Prisma.join(STOCK_CONSUMING_STATUSES)})
         AND o.created_at >= date_trunc('day', now() AT TIME ZONE ${DAY_BOUNDARY_TZ}) AT TIME ZONE ${DAY_BOUNDARY_TZ}
         AND item->>'product_id' IN (${Prisma.join(productIds)})
       GROUP BY 1
    `);

    // SUM() comes back as bigint -> BigInt in JS, which JSON.stringify
    // throws on. A day's quantity for one product is never near 2^53.
    return new Map(rows.map((row) => [row.product_id, Number(row.quantity)]));
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
