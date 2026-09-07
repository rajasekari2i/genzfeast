import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { TenantContext, TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { PasswordService } from '../auth/password.service';
import { TokenService } from '../auth/token.service';
import { AuthAuditService, AuditMeta } from '../auth/auth-audit.service';
import { AuthService } from '../auth/auth.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ProfileResponse, toProfileResponse } from './profile.mapper';

const PROFILE_INCLUDE = { role: true, category: true, department: true, company: true } as const;

/**
 * specs/007-user-profile-management. Every method acts only on the caller's
 * own account (`ctx.userId`, from the verified JWT) — no method here ever
 * takes a user id parameter (FR-014). `ctx` is already the caller's own
 * real identity (from TenantContextInterceptor), so it's passed directly to
 * `runInTenantContext` throughout — no system-actor bypass anywhere in this
 * module.
 */
@Injectable()
export class ProfileService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly authAudit: AuthAuditService,
    private readonly authService: AuthService,
  ) {}

  async getProfile(ctx: TenantContext): Promise<ProfileResponse> {
    const user = await this.tenantPrisma.runInTenantContext(ctx, (tx) =>
      tx.user.findFirstOrThrow({ where: { id: ctx.userId as string }, include: PROFILE_INCLUDE }),
    );
    return toProfileResponse(user);
  }

  /** FR-004..FR-007: all-or-nothing (a single UPDATE), Department accepted only for a Student. */
  async updateProfile(ctx: TenantContext, dto: UpdateProfileDto): Promise<ProfileResponse> {
    if (dto.department_id !== undefined && ctx.role !== 'student') {
      throw new BadRequestException('Department can only be set on a Student account');
    }

    return this.tenantPrisma.runInTenantContext(ctx, async (tx) => {
      if (dto.department_id !== undefined) {
        // research.md §3: same tenant-scoped lookup 001 already uses —
        // a department belonging to a different company is rejected
        // identically to one that doesn't exist at all.
        const department = await tx.department.findFirst({
          where: { id: dto.department_id, companyId: ctx.companyId as string, isDeleted: false },
        });
        if (!department) {
          throw new BadRequestException('Invalid department for your company');
        }
      }

      const updated = await tx.user.update({
        where: { id: ctx.userId as string },
        data: {
          ...(dto.email !== undefined && { email: dto.email }),
          ...(dto.department_id !== undefined && { departmentId: dto.department_id }),
          updatedBy: ctx.userId,
        },
        include: PROFILE_INCLUDE,
      });
      return toProfileResponse(updated);
    });
  }

  /**
   * FR-009..FR-012. New/retype mismatch is rejected before any DB read at
   * all (FR-010). Session revocation (`AuthService.revokeAllSessions`) runs
   * as a separate top-level call after the password-update transaction
   * commits, matching this codebase's established pattern of never nesting
   * a second `runInTenantContext` transaction inside another.
   */
  async changePassword(ctx: TenantContext, dto: ChangePasswordDto, meta: AuditMeta): Promise<{ message: string }> {
    if (dto.new_password !== dto.retype_password) {
      throw new BadRequestException('New password and retype password do not match');
    }

    const result = await this.tenantPrisma.runInTenantContext(ctx, async (tx) => {
      const user = await tx.user.findFirstOrThrow({ where: { id: ctx.userId as string }, include: { role: true } });

      const matches = await this.passwordService.verify(user.passwordHash, dto.current_password);
      if (!matches) {
        return { matched: false as const };
      }

      const newPasswordHash = await this.passwordService.hash(dto.new_password);
      await tx.user.update({ where: { id: user.id }, data: { passwordHash: newPasswordHash, updatedBy: ctx.userId } });

      // FR-012/research.md §2: optionally spare the session that performed
      // this change — resolved to a refresh_tokens row id here (revocation
      // itself needs the row id, not the raw token/hash).
      let exceptRefreshTokenId: string | undefined;
      if (dto.refresh_token) {
        const tokenHash = this.tokenService.hashRefreshToken(dto.refresh_token);
        const tokenRow = await tx.refreshToken.findFirst({
          where: { tokenHash, userId: user.id, revokedAt: null },
        });
        exceptRefreshTokenId = tokenRow?.id;
      }

      return {
        matched: true as const,
        authUser: { id: user.id, companyId: user.companyId, roleName: user.role.name },
        exceptRefreshTokenId,
      };
    });

    if (!result.matched) {
      await this.authAudit.passwordChangeFailed(ctx.userId as string, ctx.companyId ?? null, meta);
      throw new UnauthorizedException('Current password is incorrect');
    }

    await this.authService.revokeAllSessions(result.authUser, result.exceptRefreshTokenId);
    await this.authAudit.passwordChangeSucceeded(ctx.userId as string, ctx.companyId ?? null, meta);

    return { message: "Password updated. You've been logged out of other devices." };
  }
}
