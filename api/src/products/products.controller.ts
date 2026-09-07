import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { CurrentTenantContext } from '../common/decorators/current-tenant-context.decorator';
import type { TenantContext } from '../common/prisma/tenant-prisma.service';
import { PaginatedResult, PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ToggleSoldoutDto } from './dto/toggle-soldout.dto';
import type { ProductResponse } from './products.mapper';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png'];

/** specs/004-company-admin-product-crud contracts/openapi.yaml — /tenant/products. */
@Controller('tenant/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @Roles('company_admin', 'company_staff')
  list(
    @CurrentTenantContext() ctx: TenantContext,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<ProductResponse>> {
    return this.productsService.list(ctx, query);
  }

  @Get(':productId')
  @Roles('company_admin', 'company_staff')
  findOne(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<ProductResponse> {
    return this.productsService.findOne(ctx, productId);
  }

  @Post()
  @Roles('company_admin')
  create(@CurrentTenantContext() ctx: TenantContext, @Body() dto: CreateProductDto): Promise<ProductResponse> {
    return this.productsService.create(ctx, dto);
  }

  @Patch(':productId')
  @Roles('company_admin')
  update(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductResponse> {
    return this.productsService.update(ctx, productId, dto);
  }

  /** FR-012: shared with Staff, unlike every other write route here. */
  @Patch(':productId/soldout')
  @Roles('company_admin', 'company_staff')
  toggleSoldout(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: ToggleSoldoutDto,
  ): Promise<ProductResponse> {
    return this.productsService.toggleSoldout(ctx, productId, dto);
  }

  @Delete(':productId')
  @Roles('company_admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<void> {
    await this.productsService.remove(ctx, productId);
  }

  @Post(':productId/image')
  @Roles('company_admin')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: MAX_IMAGE_BYTES } }))
  uploadImage(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('productId', ParseUUIDPipe) productId: string,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<ProductResponse> {
    if (!file) {
      throw new BadRequestException('An image file is required');
    }
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Image must be JPEG or PNG');
    }
    return this.productsService.uploadImage(ctx, productId, file);
  }
}
