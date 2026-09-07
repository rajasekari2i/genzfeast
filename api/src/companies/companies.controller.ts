import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { CurrentTenantContext } from '../common/decorators/current-tenant-context.decorator';
import type { TenantContext } from '../common/prisma/tenant-prisma.service';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CreateCompanyAdminDto } from './dto/create-company-admin.dto';
import type { CompanyResponse, UserResponse } from './companies.mapper';

/** specs/001-company-role-user-setup contracts/openapi.yaml — Companies + the "create first Company Admin" endpoint. System Admin only. */
@Controller('admin/companies')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor)
@Roles('system_admin')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  list(@CurrentTenantContext() ctx: TenantContext): Promise<CompanyResponse[]> {
    return this.companiesService.list(ctx);
  }

  @Post()
  create(@CurrentTenantContext() ctx: TenantContext, @Body() dto: CreateCompanyDto): Promise<CompanyResponse> {
    return this.companiesService.create(ctx, dto);
  }

  @Patch(':companyId')
  update(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: UpdateCompanyDto,
  ): Promise<CompanyResponse> {
    return this.companiesService.update(ctx, companyId, dto);
  }

  @Delete(':companyId')
  @HttpCode(204)
  remove(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ): Promise<void> {
    return this.companiesService.remove(ctx, companyId);
  }

  @Post(':companyId/admins')
  createAdmin(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateCompanyAdminDto,
  ): Promise<UserResponse> {
    return this.companiesService.createCompanyAdmin(ctx, companyId, dto);
  }
}
