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
import { CreateTenantUserDto } from './dto/create-tenant-user.dto';
import { UpdateTenantUserDto } from './dto/update-tenant-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import type { UserResponse } from '../companies/companies.mapper';

/** specs/001-company-role-user-setup contracts/openapi.yaml — /tenant/users. Company Admin only, every route. */
@Controller('tenant/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor)
@Roles('company_admin')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list(@CurrentTenantContext() ctx: TenantContext): Promise<UserResponse[]> {
    return this.usersService.list(ctx);
  }

  @Post()
  create(@CurrentTenantContext() ctx: TenantContext, @Body() dto: CreateTenantUserDto): Promise<UserResponse> {
    return this.usersService.create(ctx, dto);
  }

  /** Not in the original contract — this task's own general edit, mirroring System Admin's /admin/users/:userId PATCH. */
  @Patch(':userId')
  update(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateTenantUserDto,
  ): Promise<UserResponse> {
    return this.usersService.updateTenant(ctx, userId, dto);
  }

  @Patch(':userId/status')
  updateStatus(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateUserStatusDto,
  ): Promise<UserResponse> {
    return this.usersService.updateStatus(ctx, userId, dto);
  }

  /** Not in the original contract — see UsersService.updateRole's own note. */
  @Patch(':userId/role')
  updateRole(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateUserRoleDto,
  ): Promise<UserResponse> {
    return this.usersService.updateRole(ctx, userId, dto);
  }

  /** Not in the original contract — this task's own soft delete, mirroring System Admin's /admin/users/:userId DELETE. */
  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    await this.usersService.removeTenant(ctx, userId);
  }
}
