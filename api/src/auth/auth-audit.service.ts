import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../common/prisma/tenant-prisma.service';

/** The trusted service identity every AuthAuditService write runs under (migration's `auth_audit_logs_insert` RLS policy). */
export const AUTH_SERVICE_ACTOR = 'auth_service';

export interface AuditMeta {
  ipAddress?: string;
  userAgent?: string;
}

/**
 * One method per `auth_audit_logs.event_type` value (specs/002 data-model.md
 * §2, research.md §6) — a failed login/logout/lock is not itself a row
 * mutation on `users`, so it needs an explicit application-level write to be
 * auditable at all (the same reasoning `001`'s generic trigger-based
 * `audit_logs` — specs/011 — exists for row mutations, but doesn't cover
 * this). Every write here runs under the `auth_service` system-actor
 * identity, never a real user's session context, since this table has no
 * end-user-facing write path at all (data-model.md's own "not writable by
 * any role via the API" note).
 */
@Injectable()
export class AuthAuditService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private write(
    eventType: string,
    fields: { userId?: string | null; companyId?: string | null; refreshTokenId?: string | null } & AuditMeta,
  ): Promise<unknown> {
    return this.tenantPrisma.runInTenantContext(
      { role: 'system_actor', systemActor: AUTH_SERVICE_ACTOR },
      (tx) =>
        tx.authAuditLog.create({
          data: {
            userId: fields.userId ?? null,
            companyId: fields.companyId ?? null,
            eventType,
            refreshTokenId: fields.refreshTokenId ?? null,
            ipAddress: fields.ipAddress ?? null,
            userAgent: fields.userAgent ?? null,
          },
        }),
    );
  }

  loginSuccess(userId: string, companyId: string | null, meta: AuditMeta): Promise<unknown> {
    return this.write('login_success', { userId, companyId, ...meta });
  }

  /** `userId`/`companyId` are null when the submitted username never resolved to any account (data-model.md §2). */
  loginFailedBadCredentials(
    userId: string | null,
    companyId: string | null,
    meta: AuditMeta,
  ): Promise<unknown> {
    return this.write('login_failed_bad_credentials', { userId, companyId, ...meta });
  }

  loginFailedLocked(userId: string, companyId: string | null, meta: AuditMeta): Promise<unknown> {
    return this.write('login_failed_locked', { userId, companyId, ...meta });
  }

  loginFailedInactive(userId: string, companyId: string | null, meta: AuditMeta): Promise<unknown> {
    return this.write('login_failed_inactive', { userId, companyId, ...meta });
  }

  /** The user's own account, or its Company, has been soft-deleted (System Admin's delete-from-list action). */
  loginFailedBlocked(userId: string, companyId: string | null, meta: AuditMeta): Promise<unknown> {
    return this.write('login_failed_blocked', { userId, companyId, ...meta });
  }

  logout(userId: string, companyId: string | null, refreshTokenId: string, meta: AuditMeta): Promise<unknown> {
    return this.write('logout', { userId, companyId, refreshTokenId, ...meta });
  }

  accountLocked(userId: string, companyId: string | null, meta: AuditMeta): Promise<unknown> {
    return this.write('account_locked', { userId, companyId, ...meta });
  }

  refreshReuseDetected(
    userId: string,
    companyId: string | null,
    refreshTokenId: string,
    meta: AuditMeta,
  ): Promise<unknown> {
    return this.write('refresh_reuse_detected', { userId, companyId, refreshTokenId, ...meta });
  }

  /**
   * specs/003-forgot-password-otp-reset data-model.md §2. `userId`/`companyId`
   * are null when the submitted (company_id, username) never resolved to any
   * account — written unconditionally either way (FR-016), never skipped for
   * the anti-enumeration path.
   */
  passwordResetRequested(
    userId: string | null,
    companyId: string | null,
    meta: AuditMeta,
  ): Promise<unknown> {
    return this.write('password_reset_requested', { userId, companyId, ...meta });
  }

  passwordResetSucceeded(userId: string, companyId: string | null, meta: AuditMeta): Promise<unknown> {
    return this.write('password_reset_succeeded', { userId, companyId, ...meta });
  }

  /** `userId`/`companyId` are null for a Verify submitted against a username that never resolved (Edge Cases: rejected identically to any invalid/expired code). */
  passwordResetFailedVerification(
    userId: string | null,
    companyId: string | null,
    meta: AuditMeta,
  ): Promise<unknown> {
    return this.write('password_reset_failed_verification', { userId, companyId, ...meta });
  }

  /**
   * specs/007-user-profile-management data-model.md — a successful
   * POST /me/change-password. Distinct from a password *reset* (003):
   * the caller was already logged in and knew their current password.
   */
  passwordChangeSucceeded(userId: string, companyId: string | null, meta: AuditMeta): Promise<unknown> {
    return this.write('password_change_succeeded', { userId, companyId, ...meta });
  }

  /** A wrong current-password submission — not a row mutation, so it needs this explicit write to be auditable at all (research.md §4). */
  passwordChangeFailed(userId: string, companyId: string | null, meta: AuditMeta): Promise<unknown> {
    return this.write('password_change_failed', { userId, companyId, ...meta });
  }
}
