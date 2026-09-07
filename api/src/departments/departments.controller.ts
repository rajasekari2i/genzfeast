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
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import type { DepartmentResponse } from './departments.mapper';

/** specs/001-company-role-user-setup contracts/openapi.yaml — /tenant/departments. */
@Controller('tenant/departments')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor)
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @Roles('company_admin', 'company_staff', 'student')
  list(
    @CurrentTenantContext() ctx: TenantContext,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<DepartmentResponse>> {
    return this.departmentsService.list(ctx, query);
  }

  @Get(':departmentId')
  @Roles('company_admin', 'company_staff', 'student')
  findOne(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
  ): Promise<DepartmentResponse> {
    return this.departmentsService.findOne(ctx, departmentId);
  }

  @Post()
  @Roles('company_admin')
  create(@CurrentTenantContext() ctx: TenantContext, @Body() dto: CreateDepartmentDto): Promise<DepartmentResponse> {
    return this.departmentsService.create(ctx, dto);
  }

  @Patch(':departmentId')
  @Roles('company_admin')
  update(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
    @Body() dto: UpdateDepartmentDto,
  ): Promise<DepartmentResponse> {
    return this.departmentsService.update(ctx, departmentId, dto);
  }

  @Delete(':departmentId')
  @Roles('company_admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
  ): Promise<void> {
    await this.departmentsService.remove(ctx, departmentId);
  }
}
