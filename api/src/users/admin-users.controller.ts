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
import { UsersService } from './users.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import type { UserResponse } from '../companies/companies.mapper';

/**
 * System Admin's cross-tenant Users CRUD — platform-wide, not scoped to any
 * one Company (unlike UsersController's /tenant/users, Company Admin only).
 * Mirrors CompaniesController's own /admin/companies pattern.
 */
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor)
@Roles('system_admin')
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  listAll(@CurrentTenantContext() ctx: TenantContext): Promise<UserResponse[]> {
    return this.usersService.listAll(ctx);
  }

  @Post()
  create(@CurrentTenantContext() ctx: TenantContext, @Body() dto: CreateAdminUserDto): Promise<UserResponse> {
    return this.usersService.createForCompany(ctx, dto);
  }

  @Patch(':userId')
  update(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateAdminUserDto,
  ): Promise<UserResponse> {
    return this.usersService.update(ctx, userId, dto);
  }

  @Delete(':userId')
  @HttpCode(204)
  remove(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    return this.usersService.remove(ctx, userId);
  }
}
