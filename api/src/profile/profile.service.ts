import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { TenantContext, TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { PasswordService } from '../auth/password.service';
import { TokenService } from '../auth/token.service';
import { AuthAuditService, AuditMeta } from '../auth/auth-audit.service';
import { AuthService } from '../auth/auth.service';
import { DevicesService } from '../devices/devices.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { ProfileResponse, toProfileResponse } from './profile.mapper';

const PROFILE_INCLUDE = { role: true, category: true, department: true, company: true } as const;

/**
 * The only order states that block account closure: paid for, food not yet
 * handed over. Both resolve the moment Staff completes the pickup, so the
 * block is transient and self-clearing.
 *
 * Deliberately NOT including `payment_pending`/`payment_failed`: nothing was
 * charged for those, and this app has no diner-initiated cancellation (the
 * `cancelled` status is unreachable — BRD §11), so blocking on one would
 * leave a diner who abandoned a failed payment permanently unable to close
 * their account. That is exactly the outcome Google Play's account-deletion
 * requirement exists to prevent.
 */
const PICKUP_PENDING_STATUSES = ['order_placed', 'order_ready'];

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
    private readonly devicesService: DevicesService,
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
          ...(dto.name !== undefined && { name: dto.name }),
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

  /**
   * POST /me/delete-account — self-service account closure, required by
   * Google Play's User Data policy for any app that offers account
   * creation. Distinct from UsersService.removeTenant/removeAdmin, which
   * are an administrator acting on somebody else and explicitly refuse to
   * touch the caller's own row.
   *
   * Soft delete, per this repository's never-hard-delete convention:
   * `orders`, `payment_attempts`, `order_audit_logs` and `feedback` all
   * reference `users` with onDelete: Restrict, and order history has to
   * survive for financial/legal retention. What makes that retention
   * acceptable is the scrub in the same statement — every personal field
   * on the surviving row is overwritten, so what remains is an opaque id,
   * not a person.
   *
   * The scrubbed `username` (the diner's 10-digit mobile number) frees that
   * number for a fresh registration immediately: both
   * `users_company_username_unique` and `users_global_username_unique` are
   * partial indexes on `is_deleted = false`, and
   * `check_users_cross_partition_username()` returns early for a row being
   * written with `is_deleted` set.
   */
  async deleteAccount(ctx: TenantContext, dto: DeleteAccountDto, meta: AuditMeta): Promise<void> {
    const userId = ctx.userId as string;

    const result = await this.tenantPrisma.runInTenantContext(ctx, async (tx) => {
      const user = await tx.user.findFirstOrThrow({ where: { id: userId }, include: { role: true } });

      const matches = await this.passwordService.verify(user.passwordHash, dto.current_password);
      if (!matches) {
        return { matched: false as const };
      }

      const awaitingPickup = await tx.order.findFirst({
        where: { userId, status: { in: PICKUP_PENDING_STATUSES } },
        select: { id: true },
      });
      if (awaitingPickup) {
        return { matched: true as const, blocked: true as const };
      }

      // One UPDATE carries both the soft delete and the scrub, so no
      // window exists where the row is closed but still holds personal
      // data (or the reverse). `status` goes to 'inactive' as well: a
      // closed account should read as closed to any admin list that
      // filters on status rather than is_deleted.
      await tx.user.update({
        where: { id: userId },
        data: {
          isDeleted: true,
          status: 'inactive',
          name: 'Deleted account',
          // Namespaced by the row's own id, which keeps it unique against
          // the partial indexes even in the unlikely case a future change
          // starts including soft-deleted rows in them. Not a valid
          // 10-digit mobile number, so it can never collide with a real
          // one or be submitted at login.
          username: `deleted-${userId}`,
          email: `deleted-${userId}@deleted.invalid`,
          gender: null,
          // Argon2id verification against this throws rather than
          // returning false, which is fine — AuthService.login rejects a
          // soft-deleted row before it ever reaches a password check, and
          // every forgot-password lookup filters isDeleted: false.
          passwordHash: 'account-deleted',
          resetPasswordOtp: null,
          resetPasswordOtpExpiresAt: null,
          resetPasswordOtpAttempts: 0,
          // The affiliation and academic department are personal
          // attributes of someone who is no longer here; the order
          // history that survives never reads them.
          categoryId: null,
          departmentId: null,
          updatedBy: userId,
        },
      });

      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      return {
        matched: true as const,
        blocked: false as const,
        companyId: user.companyId,
      };
    });

    if (!result.matched) {
      await this.authAudit.passwordChangeFailed(userId, ctx.companyId ?? null, meta);
      throw new UnauthorizedException('Current password is incorrect');
    }
    if (result.blocked) {
      throw new ConflictException(
        'You have an order waiting to be picked up. Collect it (or ask the canteen to complete it) before closing your account.',
      );
    }

    // Outside the transaction, matching changePassword's own pattern of
    // never nesting a second runInTenantContext inside another. Removes
    // every FCM registration, including the session-less forgot-password
    // rows that the usual logout/lock cascades deliberately spare — a
    // closed account must keep no push reachability at all.
    await this.devicesService.deleteAllForUser(userId);
    await this.authAudit.accountDeleted(userId, result.companyId, meta);
  }
}
