import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { CurrentTenantContext } from '../common/decorators/current-tenant-context.decorator';
import type { TenantContext } from '../common/prisma/tenant-prisma.service';
import type { AuditMeta } from '../auth/auth-audit.service';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import type { ProfileResponse } from './profile.mapper';

function requestMeta(req: Request): AuditMeta {
  return { ipAddress: req.ip, userAgent: req.get('user-agent') };
}

/**
 * specs/007-user-profile-management contracts/openapi.yaml — /me/*. No
 * `@Roles(...)` anywhere here — every role may view/edit their own profile
 * and change their own password; RolesGuard treats an empty/absent list as
 * unrestricted.
 */
@Controller('me')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantContextInterceptor)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('profile')
  getProfile(@CurrentTenantContext() ctx: TenantContext): Promise<ProfileResponse> {
    return this.profileService.getProfile(ctx);
  }

  @Patch('profile')
  updateProfile(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileResponse> {
    return this.profileService.updateProfile(ctx, dto);
  }

  @Post('change-password')
  changePassword(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    return this.profileService.changePassword(ctx, dto, requestMeta(req));
  }

  /**
   * Self-service account closure — Google Play's User Data policy requires
   * it of any app offering account creation. POST rather than DELETE so the
   * password confirmation travels in a body every proxy and client handles
   * consistently, and to match change-password's shape directly above.
   *
   * No `@Roles(...)`, like everything else in this controller: every role
   * may close their own account. A Company Admin closing theirs is the
   * tenant's problem to recover from (System Admin can create a
   * replacement via /admin/users), not something to special-case here.
   */
  @Post('delete-account')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: DeleteAccountDto,
    @Req() req: Request,
  ): Promise<void> {
    await this.profileService.deleteAccount(ctx, dto, requestMeta(req));
  }
}
