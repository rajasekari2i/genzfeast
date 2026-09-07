import {
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
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { CurrentTenantContext } from '../common/decorators/current-tenant-context.decorator';
import type { TenantContext } from '../common/prisma/tenant-prisma.service';
import { PaginatedResult, PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import type { CategoryResponse } from './categories.mapper';

/** specs/001-company-role-user-setup contracts/openapi.yaml — /tenant/categories. */
@Controller('tenant/categories')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @Roles('company_admin', 'company_staff', 'student')
  list(
    @CurrentTenantContext() ctx: TenantContext,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<CategoryResponse>> {
    return this.categoriesService.list(ctx, query);
  }

  @Get(':categoryId')
  @Roles('company_admin', 'company_staff', 'student')
  findOne(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ): Promise<CategoryResponse> {
    return this.categoriesService.findOne(ctx, categoryId);
  }

  @Post()
  @Roles('company_admin')
  create(@CurrentTenantContext() ctx: TenantContext, @Body() dto: CreateCategoryDto): Promise<CategoryResponse> {
    return this.categoriesService.create(ctx, dto);
  }

  @Patch(':categoryId')
  @Roles('company_admin')
  update(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryResponse> {
    return this.categoriesService.update(ctx, categoryId, dto);
  }

  @Delete(':categoryId')
  @Roles('company_admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ): Promise<void> {
    await this.categoriesService.remove(ctx, categoryId);
  }
}
