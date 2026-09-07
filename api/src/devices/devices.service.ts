import { createHash } from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { TenantContext, TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { AUTH_SERVICE_ACTOR } from '../auth/auth-audit.service';

/**
 * specs/009-order-fcm-push-notifications, now fully built: the authenticated
 * `POST /me/devices` registration (FR-001/FR-002/FR-003), the unauthenticated
 * path specs/003's forgot-password request uses (FR-011, research.md §7),
 * lookup for sending, and the cascading removals FR-008/research.md §3
 * requires (called from AuthService, not here — see auth.service.ts's
 * `logout`/`revokeAllSessions`). The unauthenticated/lookup/cascade methods
 * run under the `auth_service` system-actor identity (no user session
 * exists at those call sites); `registerAuthenticated` instead runs under
 * the caller's own real context, since that endpoint IS an authenticated,
 * self-scoped request.
 */
const SYSTEM_ACTOR_CONTEXT: TenantContext = { role: 'system_actor', systemActor: AUTH_SERVICE_ACTOR };

@Injectable()
export class DevicesService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  /**
   * FR-001/FR-002/FR-003, research.md §1. `refresh_token` must belong to the
   * caller and currently be valid (unrevoked, unexpired) — this is what lets
   * FR-008's logout cascade later identify precisely which single
   * registration to remove. Deliberately hashes the token with the same
   * SHA-256 scheme `TokenService.hashRefreshToken` uses rather than
   * depending on AuthModule for it — that would create a circular module
   * dependency, since AuthModule itself depends on DevicesModule for the
   * cascade-delete calls below.
   */
  async registerAuthenticated(ctx: TenantContext, fcmToken: string, rawRefreshToken: string): Promise<void> {
    const tokenHash = createHash('sha256').update(rawRefreshToken).digest('hex');

    await this.tenantPrisma.runInTenantContext(ctx, async (tx) => {
      const tokenRow = await tx.refreshToken.findFirst({
        where: { userId: ctx.userId as string, tokenHash, revokedAt: null },
      });
      if (!tokenRow || tokenRow.expiresAt.getTime() <= Date.now()) {
        throw new UnauthorizedException('refresh_token does not belong to you or is not currently valid');
      }

      await tx.deviceRegistration.upsert({
        where: { fcmToken },
        create: { userId: ctx.userId as string, fcmToken, refreshTokenId: tokenRow.id },
        update: { userId: ctx.userId as string, refreshTokenId: tokenRow.id },
      });
    });
  }

  /**
   * (research.md §7) Registers/updates a device with no `refresh_token_id`
   * link — exempt from every session-based cascade below (FR-008's own
   * text), since there is no session to end. `fcm_token` is globally unique
   * (data-model.md §1): re-registering an existing token upserts it onto
   * the given user rather than creating a second row.
   */
  async upsertUnauthenticated(userId: string, fcmToken: string): Promise<void> {
    await this.tenantPrisma.runInTenantContext(SYSTEM_ACTOR_CONTEXT, (tx) =>
      tx.deviceRegistration.upsert({
        where: { fcmToken },
        create: { userId, fcmToken, refreshTokenId: null },
        update: { userId, refreshTokenId: null },
      }),
    );
  }

  /** Every currently-registered token for a user, for the FCM adapter to send to. */
  async listTokensForUser(userId: string): Promise<string[]> {
    const rows = await this.tenantPrisma.runInTenantContext(SYSTEM_ACTOR_CONTEXT, (tx) =>
      tx.deviceRegistration.findMany({ where: { userId }, select: { fcmToken: true } }),
    );
    return rows.map((r) => r.fcmToken);
  }

  /** Removes one token — e.g. when FCM reports it as no-longer-valid at send time. */
  async removeToken(fcmToken: string): Promise<void> {
    await this.tenantPrisma.runInTenantContext(SYSTEM_ACTOR_CONTEXT, (tx) =>
      tx.deviceRegistration.deleteMany({ where: { fcmToken } }),
    );
  }

  /** FR-008/research.md §3 — explicit logout: removes exactly the one registration tied to that session. */
  async deleteByRefreshTokenId(refreshTokenId: string): Promise<void> {
    await this.tenantPrisma.runInTenantContext(SYSTEM_ACTOR_CONTEXT, (tx) =>
      tx.deviceRegistration.deleteMany({ where: { refreshTokenId } }),
    );
  }

  /**
   * FR-008/research.md §3 — account lock (no exception) or a password
   * change (spares the acting session, if any). Never touches a
   * `refresh_token_id IS NULL` row (the unauthenticated/FR-011 path) —
   * those are exempt from every session-based cascade by definition.
   */
  async deleteSessionLinkedForUser(userId: string, exceptRefreshTokenId?: string): Promise<void> {
    await this.tenantPrisma.runInTenantContext(SYSTEM_ACTOR_CONTEXT, (tx) =>
      tx.deviceRegistration.deleteMany({
        where: {
          userId,
          refreshTokenId: { not: null, notIn: exceptRefreshTokenId ? [exceptRefreshTokenId] : undefined },
        },
      }),
    );
  }
}
