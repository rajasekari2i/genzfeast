import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { randomBytes, randomInt } from 'crypto';
import { TenantContext, TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { AuthAuditService, AuditMeta, AUTH_SERVICE_ACTOR } from './auth-audit.service';
import { OtpService } from './otp.service';
import { NotificationPort } from '../notifications/notification.port';
import { DevicesService } from '../devices/devices.service';
import { Msg91SmsAdapter } from '../notifications/msg91-sms.adapter';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordRequestDto } from './dto/forgot-password-request.dto';
import { ForgotPasswordVerifyDto } from './dto/forgot-password-verify.dto';
import { RegisterStudentDto } from './dto/register-student.dto';
import { SendMobileVerificationDto } from './dto/send-mobile-verification.dto';
import { VerifyMobileDto } from './dto/verify-mobile.dto';

// specs/014-msg91-sms-otp-mobile-verification — long enough to finish the
// rest of the registration form, short enough not to become a long-lived
// reusable bearer credential.
const MOBILE_VERIFICATION_TOKEN_TTL_MINUTES = 20;

/** Numeric-only, same shape as payments.service.ts's own generateNumericOtp — this flow's code is SMS-delivered, unlike password-reset's alphanumeric one above. */
function generateNumericVerificationCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export interface SessionResponse {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
}

export interface AuthenticatedUserResponse extends SessionResponse {
  user: {
    id: string;
    company_id: string | null;
    role: string;
    name: string;
    username: string;
  };
}

export interface RegistrationOption {
  id: string;
  name: string;
}

export interface RegistrationOptionsResponse {
  categories: RegistrationOption[];
  departments: RegistrationOption[];
}

/** The minimal shape `issueSession`/internal session logic needs from a `users` row (plus its resolved role name). */
export interface AuthUser {
  id: string;
  companyId: string | null;
  roleName: string;
  name: string;
  username: string;
}

const GENERIC_INVALID_CREDENTIALS = 'Invalid username or password';

/** RLS context representing the given user's own real identity — satisfies every "self" predicate without any system-actor bypass. */
function userContext(user: Pick<AuthUser, 'id' | 'roleName' | 'companyId'>): TenantContext {
  return { userId: user.id, role: user.roleName, companyId: user.companyId };
}

/** RLS context for a pre-authentication lookup where no user identity is known yet (migration's `auth_service` bypass). */
const PRE_AUTH_CONTEXT: TenantContext = { role: 'system_actor', systemActor: AUTH_SERVICE_ACTOR };

@Injectable()
export class AuthService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly authAudit: AuthAuditService,
    private readonly configService: ConfigService,
    private readonly otpService: OtpService,
    private readonly notificationPort: NotificationPort,
    private readonly devicesService: DevicesService,
    // specs/014-msg91-sms-otp-mobile-verification. Deliberately NOT routed
    // through NotificationPort (which stays FCM-only, unlike an earlier
    // draft of this feature that put all three OTP flows behind it) — only
    // this one new flow uses SMS, so it's injected directly rather than
    // widening the shared FCM abstraction's contract.
    private readonly msg91SmsAdapter: Msg91SmsAdapter,
  ) {}

  /**
   * Persists a new refresh_tokens row and returns the AuthenticatedUserResponse
   * shape (specs/002 tasks.md T008) — the single method both a future
   * registration endpoint and this feature's own login/refresh call to hand
   * back a session.
   */
  async issueSession(user: AuthUser, meta: AuditMeta): Promise<AuthenticatedUserResponse> {
    const { response } = await this.createSessionRow(user, meta);
    return response;
  }

  /** Same as issueSession, but also returns the created row's id — refresh() needs it to link `replaced_by`. */
  private async createSessionRow(
    user: AuthUser,
    meta: AuditMeta,
  ): Promise<{ response: AuthenticatedUserResponse; refreshTokenId: string }> {
    const accessToken = await this.tokenService.signAccessToken({
      sub: user.id,
      role: user.roleName,
      companyId: user.companyId,
    });
    const refreshToken = this.tokenService.generateRefreshToken();
    const expiresAt = new Date(Date.now() + this.tokenService.refreshTokenTtlMs());

    const row = await this.tenantPrisma.runInTenantContext(userContext(user), (tx) =>
      tx.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: refreshToken.hash,
          expiresAt,
          userAgent: meta.userAgent ?? null,
          ipAddress: meta.ipAddress ?? null,
        },
      }),
    );

    return {
      refreshTokenId: row.id,
      response: {
        user: {
          id: user.id,
          company_id: user.companyId,
          role: user.roleName,
          name: user.name,
          username: user.username,
        },
        access_token: accessToken.token,
        refresh_token: refreshToken.raw,
        token_type: 'Bearer',
        expires_in: accessToken.expiresIn,
      },
    };
  }

  /**
   * (specs/002 tasks.md T011) Looks up by (company_id, username) for a
   * company-scoped role, or by username alone (company_id IS NULL) for
   * system_admin (research.md §5/§5a) — the request's own company_id
   * presence/absence selects the branch. Deliberately does NOT filter
   * isDeleted:false here (unlike every other lookup in this file) — a
   * soft-deleted user, or one whose Company was soft-deleted, must still
   * resolve to a row so it can be rejected with the distinct "blocked"
   * message below, the same way locked/inactive are, instead of falling
   * into the generic not-found branch. Locked/inactive/blocked is checked,
   * and rejected with a distinct message, before the password is even
   * compared (research.md §5) — no Argon2id cycle spent on an account that
   * cannot log in anyway.
   */
  async login(dto: LoginDto, meta: AuditMeta): Promise<AuthenticatedUserResponse> {
    const found = await this.tenantPrisma.runInTenantContext(PRE_AUTH_CONTEXT, (tx) =>
      tx.user.findFirst({
        where: {
          companyId: dto.company_id ?? null,
          username: { equals: dto.username, mode: 'insensitive' },
        },
        include: { role: true, company: true },
      }),
    );

    if (!found) {
      await this.authAudit.loginFailedBadCredentials(null, null, meta);
      throw new UnauthorizedException(GENERIC_INVALID_CREDENTIALS);
    }

    const user: AuthUser = {
      id: found.id,
      companyId: found.companyId,
      roleName: found.role.name,
      name: found.name,
      username: found.username,
    };

    // A System Admin's delete-from-list action (Companies/Users pages) only
    // ever soft-deletes (CLAUDE.md's Data Conventions) — checked ahead of
    // locked/inactive, covering both the user's own account and every user
    // of a Company that was itself deleted (found.company is null for
    // system_admin, which has none, so the optional-chain short-circuits).
    if (found.isDeleted || found.company?.isDeleted) {
      await this.authAudit.loginFailedBlocked(user.id, user.companyId, meta);
      throw new ForbiddenException({ message: 'blocked contact admin', reason: 'blocked' });
    }

    // FR-014: status is checked — and rejected with its own distinct message
    // — before the password is compared at all, regardless of whether the
    // submitted password would have matched.
    if (found.status === 'locked') {
      await this.authAudit.loginFailedLocked(user.id, user.companyId, meta);
      throw new ForbiddenException({
        message: 'Your account is locked. Reset your password to regain access.',
        reason: 'locked',
      });
    }
    if (found.status === 'inactive') {
      await this.authAudit.loginFailedInactive(user.id, user.companyId, meta);
      throw new ForbiddenException({
        message: 'Your account is inactive. Contact your administrator.',
        reason: 'inactive',
      });
    }

    const passwordMatches = await this.passwordService.verify(found.passwordHash, dto.password);
    if (!passwordMatches) {
      await this.handleFailedPassword(user, found.noOfLoginAttempt, meta);
      throw new UnauthorizedException(GENERIC_INVALID_CREDENTIALS);
    }

    await this.tenantPrisma.runInTenantContext(userContext(user), (tx) =>
      tx.user.update({ where: { id: user.id }, data: { noOfLoginAttempt: 0 } }),
    );
    await this.authAudit.loginSuccess(user.id, user.companyId, meta);
    return this.issueSession(user, meta);
  }

  /** FR-012/FR-013/FR-015: increments the counter and locks (+ revokes every session) at the configured threshold. */
  private async handleFailedPassword(user: AuthUser, currentAttempts: number, meta: AuditMeta): Promise<void> {
    const threshold = this.configService.getOrThrow<number>('ACCOUNT_LOCK_THRESHOLD');
    const nextAttempts = currentAttempts + 1;
    const willLock = nextAttempts >= threshold;

    await this.tenantPrisma.runInTenantContext(userContext(user), (tx) =>
      tx.user.update({
        where: { id: user.id },
        data: { noOfLoginAttempt: nextAttempts, ...(willLock && { status: 'locked' }) },
      }),
    );
    await this.authAudit.loginFailedBadCredentials(user.id, user.companyId, meta);

    if (willLock) {
      await this.revokeAllSessions(user);
      await this.authAudit.accountLocked(user.id, user.companyId, meta);
    }
  }

  /**
   * (specs/002 tasks.md T018/T023 — generalized in one step, since no caller
   * needed the narrower single-argument form independently) Revokes every
   * non-revoked refresh_tokens row for a user, optionally sparing one (the
   * session performing a change — 003's password reset, 007's change-password).
   * specs/009 FR-008/research.md §3: also removes every session-linked
   * `device_registrations` row among the ones just revoked (never the
   * unauthenticated/FR-011 rows, which have no session to end) — the same
   * "revoke this set of refresh token ids" operation, extended to a second
   * table, not a new revocation concept.
   */
  async revokeAllSessions(
    user: Pick<AuthUser, 'id' | 'roleName' | 'companyId'>,
    exceptRefreshTokenId?: string,
  ): Promise<void> {
    await this.tenantPrisma.runInTenantContext(userContext(user), (tx) =>
      tx.refreshToken.updateMany({
        where: {
          userId: user.id,
          revokedAt: null,
          ...(exceptRefreshTokenId && { id: { not: exceptRefreshTokenId } }),
        },
        data: { revokedAt: new Date() },
      }),
    );
    await this.devicesService.deleteSessionLinkedForUser(user.id, exceptRefreshTokenId);
  }

  /**
   * (specs/002 tasks.md T014) Rotates a valid refresh token; detects reuse
   * of an already-rotated one and revokes every session for that user
   * (FR-017, research.md §4).
   */
  async refresh(rawRefreshToken: string, meta: AuditMeta): Promise<SessionResponse> {
    const tokenHash = this.tokenService.hashRefreshToken(rawRefreshToken);
    const found = await this.tenantPrisma.runInTenantContext(PRE_AUTH_CONTEXT, (tx) =>
      tx.refreshToken.findUnique({
        where: { tokenHash },
        include: { user: { include: { role: true } } },
      }),
    );

    if (!found) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user: AuthUser = {
      id: found.user.id,
      companyId: found.user.companyId,
      roleName: found.user.role.name,
      name: found.user.name,
      username: found.user.username,
    };

    if (found.revokedAt !== null) {
      // A revoked token is only a theft (reuse) signal when it was revoked
      // BY ROTATION — i.e. it was already successfully exchanged for a
      // successor (replacedBy IS NOT NULL) and is now being presented again
      // (research.md §4, FR-017: "a renewal credential that has ALREADY BEEN
      // EXCHANGED"). A token revoked for any other reason (logout, lock,
      // password change) was never exchanged and must be rejected plainly,
      // with no further side effect — spec.md User Story 5 Scenario 2
      // explicitly requires that logging out (and, by extension, replaying
      // that now-dead token) never disturbs a different, healthy session
      // for the same account. Conflating the two would mass-revoke every
      // session the moment anyone replayed an already-logged-out token.
      if (found.replacedBy !== null) {
        await this.revokeAllSessions(user);
        await this.authAudit.refreshReuseDetected(user.id, user.companyId, found.id, meta);
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    if (found.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const { response, refreshTokenId } = await this.createSessionRow(user, meta);
    await this.tenantPrisma.runInTenantContext(userContext(user), (tx) =>
      tx.refreshToken.update({
        where: { id: found.id },
        data: { revokedAt: new Date(), replacedBy: refreshTokenId },
      }),
    );

    return {
      access_token: response.access_token,
      refresh_token: response.refresh_token,
      token_type: response.token_type,
      expires_in: response.expires_in,
    };
  }

  /**
   * (specs/002 tasks.md T020) Revokes the matching session by hash; a
   * non-matching/unknown token is treated as a no-op (204 either way) so
   * this endpoint never reveals whether a given refresh token string is
   * recognized.
   */
  async logout(ctx: TenantContext, rawRefreshToken: string): Promise<void> {
    const tokenHash = this.tokenService.hashRefreshToken(rawRefreshToken);
    const revokedTokenId = await this.tenantPrisma.runInTenantContext(ctx, async (tx) => {
      const row = await tx.refreshToken.findFirst({
        where: { userId: ctx.userId, tokenHash, revokedAt: null },
      });
      if (!row) {
        return null;
      }
      await tx.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
      await this.authAudit.logout(ctx.userId as string, ctx.companyId ?? null, row.id, {});
      return row.id;
    });

    // specs/009 FR-008/research.md §3: removes precisely that one device's
    // registration — never any other session's, and never the
    // unauthenticated/FR-011 rows (which have no refresh_token_id to match).
    if (revokedTokenId) {
      await this.devicesService.deleteByRefreshTokenId(revokedTokenId);
    }
  }

  /**
   * specs/003-forgot-password-otp-reset tasks.md T006. Looks up the account
   * exactly like login() does; the response is identical regardless of
   * outcome (FR-004). The not-found branch still performs comparable OTP
   * crypto work (research.md §5) so a not-found lookup isn't structurally
   * cheaper than a found one.
   */
  async requestPasswordReset(dto: ForgotPasswordRequestDto, meta: AuditMeta): Promise<{ message: string }> {
    const found = await this.tenantPrisma.runInTenantContext(PRE_AUTH_CONTEXT, (tx) =>
      tx.user.findFirst({
        where: {
          isDeleted: false,
          companyId: dto.company_id ?? null,
          username: { equals: dto.username, mode: 'insensitive' },
        },
        include: { role: true },
      }),
    );

    if (found) {
      const user: AuthUser = {
        id: found.id,
        companyId: found.companyId,
        roleName: found.role.name,
        name: found.name,
        username: found.username,
      };

      const code = this.otpService.generateCode();
      const codeHash = this.otpService.hashCode(code);
      const ttlMinutes = this.configService.getOrThrow<number>('RESET_PASSWORD_OTP_TTL_MINUTES');
      const threshold = this.configService.getOrThrow<number>('ACCOUNT_LOCK_THRESHOLD');
      // FR-005/Edge Cases: reset requests drive the same shared counter as
      // failed logins, and can lock the account on their own.
      const nextAttempts = found.noOfLoginAttempt + 1;
      const willLock = nextAttempts >= threshold;

      await this.tenantPrisma.runInTenantContext(userContext(user), (tx) =>
        tx.user.update({
          where: { id: user.id },
          data: {
            // FR-014: unconditionally overwrites any prior outstanding code.
            resetPasswordOtp: codeHash,
            resetPasswordOtpExpiresAt: new Date(Date.now() + ttlMinutes * 60_000),
            resetPasswordOtpAttempts: 0,
            noOfLoginAttempt: nextAttempts,
            ...(willLock && { status: 'locked' }),
          },
        }),
      );

      // FR-017: registers the device for push delivery when the account
      // resolved and a token was submitted — gives a just-locked account
      // (whose session-linked registrations research.md §3's cascade would
      // otherwise have just removed) a channel to receive the push below.
      // Never affects the response either way (research.md §7).
      if (dto.fcm_token) {
        await this.devicesService.upsertUnauthenticated(user.id, dto.fcm_token).catch(() => undefined);
      }

      // A NotificationPort failure/timeout must never fail this request —
      // the code is already persisted regardless of delivery outcome
      // (User Story 3 / tasks.md T014).
      await this.notificationPort.sendPasswordResetCode(user.id, code).catch(() => undefined);

      await this.authAudit.passwordResetRequested(user.id, user.companyId, meta);
      if (willLock) {
        await this.revokeAllSessions(user);
        await this.authAudit.accountLocked(user.id, user.companyId, meta);
      }
    } else {
      // Anti-enumeration timing (research.md §5): comparable crypto work,
      // no DB write (there is no row to write to).
      const dummyCode = this.otpService.generateCode();
      this.otpService.hashCode(dummyCode);
      await this.authAudit.passwordResetRequested(null, null, meta);
    }

    // FR-004: byte-identical response regardless of outcome.
    return { message: 'If an account exists for this username, a code has been sent.' };
  }

  /**
   * specs/003-forgot-password-otp-reset tasks.md T011. New/retype mismatch is
   * rejected before any code check runs at all (FR-008). Every other
   * rejection path (unknown account, wrong/expired/exhausted code) throws
   * the identical generic error (FR-012) so none of them reveal which
   * condition failed.
   */
  async verifyPasswordReset(dto: ForgotPasswordVerifyDto, meta: AuditMeta): Promise<{ message: string }> {
    if (dto.new_password !== dto.retype_password) {
      throw new BadRequestException('New password and retype password do not match');
    }

    const genericInvalidCode = () => new UnprocessableEntityException('Invalid or expired code');

    const found = await this.tenantPrisma.runInTenantContext(PRE_AUTH_CONTEXT, (tx) =>
      tx.user.findFirst({
        where: {
          isDeleted: false,
          companyId: dto.company_id ?? null,
          username: { equals: dto.username, mode: 'insensitive' },
        },
        include: { role: true },
      }),
    );

    if (!found) {
      await this.authAudit.passwordResetFailedVerification(null, null, meta);
      throw genericInvalidCode();
    }

    const user: AuthUser = {
      id: found.id,
      companyId: found.companyId,
      roleName: found.role.name,
      name: found.name,
      username: found.username,
    };

    const maxAttempts = this.configService.getOrThrow<number>('RESET_PASSWORD_OTP_MAX_ATTEMPTS');
    // data-model.md §1 validity rule.
    const notExpiredAndOutstanding =
      found.resetPasswordOtp !== null &&
      found.resetPasswordOtpExpiresAt !== null &&
      found.resetPasswordOtpExpiresAt.getTime() > Date.now() &&
      found.resetPasswordOtpAttempts < maxAttempts;
    const codeMatches = notExpiredAndOutstanding && found.resetPasswordOtp === this.otpService.hashCode(dto.code);

    if (!codeMatches) {
      // research.md §4: an incorrect submission increments attempts unless
      // the code is already dead (nothing further to count toward).
      if (notExpiredAndOutstanding) {
        await this.tenantPrisma.runInTenantContext(userContext(user), (tx) =>
          tx.user.update({
            where: { id: user.id },
            data: { resetPasswordOtpAttempts: { increment: 1 } },
          }),
        );
      }
      await this.authAudit.passwordResetFailedVerification(user.id, user.companyId, meta);
      throw genericInvalidCode();
    }

    const newPasswordHash = await this.passwordService.hash(dto.new_password);
    await this.tenantPrisma.runInTenantContext(userContext(user), (tx) =>
      tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: newPasswordHash,
          resetPasswordOtp: null,
          resetPasswordOtpExpiresAt: null,
          resetPasswordOtpAttempts: 0,
          noOfLoginAttempt: 0,
          // FR-010: only ever restores `locked` → `active`; `inactive` is
          // never touched here (Edge Cases).
          ...(found.status === 'locked' && { status: 'active' }),
        },
      }),
    );

    // FR-011: this endpoint is unauthenticated (contracts/openapi.yaml) — no
    // refresh token performed this reset, so every session is revoked, none
    // spared.
    await this.revokeAllSessions(user);
    await this.authAudit.passwordResetSucceeded(user.id, user.companyId, meta);

    return { message: 'Your password has been reset. Please log in with your new password.' };
  }

  /**
   * Unauthenticated, company_id-scoped lookup so the Registration screen can
   * populate its Category/Department dropdowns before the user has any
   * account at all (FR-012). Not part of any spec's original contract —
   * added because no other endpoint can be called pre-auth; scoped as
   * narrowly as the gap requires: id+name only (no other Category/Department
   * fields), and only for a caller-supplied company_id, the same way
   * `/auth/register` itself is scoped. An unknown company_id simply yields
   * two empty lists (no separate `companies` existence check — that table
   * stays un-widened, see `registerStudent`'s own note on this).
   */
  async getRegistrationOptions(companyId: string): Promise<RegistrationOptionsResponse> {
    return this.tenantPrisma.runInTenantContext(PRE_AUTH_CONTEXT, async (tx) => {
      const [categories, departments] = await Promise.all([
        tx.category.findMany({
          where: { companyId, isDeleted: false },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        }),
        tx.department.findMany({
          where: { companyId, isDeleted: false },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        }),
      ]);
      return { categories, departments };
    });
  }

  /**
   * specs/014-msg91-sms-otp-mobile-verification. Unauthenticated —
   * no User row exists yet, so this upserts its own pre-account
   * mobile_verifications row (company_id, mobile_number) rather than
   * reusing users.reset_password_otp*'s columns the way 003 does. Channel
   * is per-Company (specs/001 FR-002a, `companies.is_sms`): SMS-primary
   * (via Msg91SmsAdapter) when true (default), with FCM push only as a
   * failure-fallback (FR-007); FCM-primary (MSG91 never attempted) when
   * false. Either way, password-reset/order-pickup stay on FCM
   * (NotificationPort) unaffected by this Company setting.
   *
   * Resend-cooldown (FR-005): a real, billed SMS send per call when
   * SMS-primary, so this returns a real 429 rather than silently no-opping
   * — left as one shared limit even for `is_sms=false` companies (where no
   * SMS is ever attempted) rather than adding a second, channel-specific
   * rate limit.
   */
  async sendMobileVerification(dto: SendMobileVerificationDto): Promise<{ message: string }> {
    const cooldownSeconds = this.configService.getOrThrow<number>('MOBILE_VERIFICATION_RESEND_COOLDOWN_SECONDS');
    const ttlMinutes = this.configService.getOrThrow<number>('MOBILE_VERIFICATION_OTP_TTL_MINUTES');

    const existing = await this.tenantPrisma.runInTenantContext(PRE_AUTH_CONTEXT, (tx) =>
      tx.mobileVerification.findUnique({
        where: { companyId_mobileNumber: { companyId: dto.company_id, mobileNumber: dto.mobile_number } },
      }),
    );
    if (existing && Date.now() - existing.lastSentAt.getTime() < cooldownSeconds * 1000) {
      throw new HttpException('Please wait before requesting another code', HttpStatus.TOO_MANY_REQUESTS);
    }

    // Numeric-only (not OtpService.generateCode()'s alphanumeric shape,
    // used by password-reset above for a push-notification-readable code)
    // — matches the order-pickup OTP's own format and standard SMS/Android
    // Autofill convention, appropriate here since this is the one flow
    // actually delivered by SMS.
    const code = generateNumericVerificationCode();
    const codeHash = this.otpService.hashCode(code);
    const now = new Date();
    const otpExpiresAt = new Date(now.getTime() + ttlMinutes * 60_000);

    await this.tenantPrisma.runInTenantContext(PRE_AUTH_CONTEXT, (tx) =>
      tx.mobileVerification.upsert({
        where: { companyId_mobileNumber: { companyId: dto.company_id, mobileNumber: dto.mobile_number } },
        create: {
          companyId: dto.company_id,
          mobileNumber: dto.mobile_number,
          otpHash: codeHash,
          otpExpiresAt,
          lastSentAt: now,
        },
        // A new send always supersedes any prior one, including an
        // already-verified-but-not-yet-consumed token — same "at most one
        // outstanding" rule 003's resetPasswordOtp already established.
        update: { otpHash: codeHash, otpExpiresAt, otpAttempts: 0, lastSentAt: now, verifiedAt: null, verificationToken: null, tokenExpiresAt: null },
      }),
    );

    // specs/001 FR-002a: the owning Company can disable SMS entirely (e.g.
    // to avoid MSG91's per-send cost) — no company-existence validation is
    // added here (this method has never had one; a bogus company_id already
    // fails via mobile_verifications' FK to companies), so a lookup miss
    // defensively defaults to today's SMS-primary behavior.
    const company = await this.tenantPrisma.runInTenantContext(PRE_AUTH_CONTEXT, (tx) =>
      tx.company.findFirst({ where: { id: dto.company_id, isDeleted: false }, select: { isSms: true } }),
    );
    const isSmsEnabled = company?.isSms ?? true;

    if (!isSmsEnabled) {
      // FCM is this Company's configured primary channel — MSG91 is never
      // attempted, unlike the SMS-failure fallback below.
      if (dto.fcm_token) {
        const { sent } = await this.notificationPort.sendMobileVerificationPush(dto.fcm_token, code, dto.mobile_number);
        if (sent) {
          return { message: 'A verification code has been sent via push notification.' };
        }
      }
      throw new ServiceUnavailableException('Could not send verification code, please try again');
    }

    try {
      await this.msg91SmsAdapter.sendVerificationCode(dto.mobile_number, code);
    } catch {
      // FR-006/FR-007: SMS failed — fall back to a best-effort FCM push to
      // the registering device's own token, if the client supplied one.
      // Deliberately does NOT reuse NotificationPort's user-keyed sends
      // (sendPasswordResetCode/sendOrderReadyNotification) — no `users`
      // row exists yet at this point in registration.
      if (dto.fcm_token) {
        const { sent } = await this.notificationPort.sendMobileVerificationPush(dto.fcm_token, code, dto.mobile_number);
        if (sent) {
          return { message: 'Could not send SMS — your code has been delivered to this device instead.' };
        }
      }
      throw new ServiceUnavailableException('Could not send verification code, please try again');
    }

    return { message: 'A verification code has been sent.' };
  }

  /** specs/014-msg91-sms-otp-mobile-verification. Same validity-rule shape as verifyPasswordReset. */
  async verifyMobile(dto: VerifyMobileDto): Promise<{ verified: true; verification_token: string; expires_in: number }> {
    const genericInvalidCode = () => new UnprocessableEntityException('Invalid or expired code');

    const found = await this.tenantPrisma.runInTenantContext(PRE_AUTH_CONTEXT, (tx) =>
      tx.mobileVerification.findUnique({
        where: { companyId_mobileNumber: { companyId: dto.company_id, mobileNumber: dto.mobile_number } },
      }),
    );
    if (!found) {
      throw genericInvalidCode();
    }

    const maxAttempts = this.configService.getOrThrow<number>('MOBILE_VERIFICATION_OTP_MAX_ATTEMPTS');
    const notExpiredAndOutstanding = found.otpExpiresAt.getTime() > Date.now() && found.otpAttempts < maxAttempts;
    const codeMatches = notExpiredAndOutstanding && found.otpHash === this.otpService.hashCode(dto.code);

    if (!codeMatches) {
      if (notExpiredAndOutstanding) {
        await this.tenantPrisma.runInTenantContext(PRE_AUTH_CONTEXT, (tx) =>
          tx.mobileVerification.update({ where: { id: found.id }, data: { otpAttempts: { increment: 1 } } }),
        );
      }
      throw genericInvalidCode();
    }

    const verificationToken = randomBytes(32).toString('hex');
    const now = new Date();
    const tokenExpiresAt = new Date(now.getTime() + MOBILE_VERIFICATION_TOKEN_TTL_MINUTES * 60_000);

    await this.tenantPrisma.runInTenantContext(PRE_AUTH_CONTEXT, (tx) =>
      tx.mobileVerification.update({
        where: { id: found.id },
        data: { verifiedAt: now, verificationToken, tokenExpiresAt },
      }),
    );

    return { verified: true, verification_token: verificationToken, expires_in: MOBILE_VERIFICATION_TOKEN_TTL_MINUTES * 60 };
  }

  /**
   * (specs/001-company-role-user-setup contracts/openapi.yaml POST
   * /auth/register, FR-011..FR-015, as extended by
   * specs/002-registration-login-jwt-auth's own contract/FR-001: the
   * response also carries a Session so the client is signed in immediately,
   * with zero separate login call — reuses `issueSession`, the exact method
   * 002's own tasks.md T008 built for this future caller). Unauthenticated,
   * so every lookup here runs under PRE_AUTH_CONTEXT — including the
   * category/department validation reads, which is why this feature's own
   * migration (20260906150000_student_self_registration) widens
   * categories_tenant_isolation/departments_tenant_isolation with the same
   * auth_service bypass 002 already established for users/roles. The
   * `company_id`'s existence is verified indirectly, by requiring its
   * `student` role to resolve — a bogus company_id has no such role, so no
   * separate `companies` read (deliberately left un-widened, FR-016) is
   * needed.
   */
  async registerStudent(dto: RegisterStudentDto, meta: AuditMeta): Promise<AuthenticatedUserResponse> {
    const created = await this.tenantPrisma.runInTenantContext(PRE_AUTH_CONTEXT, async (tx) => {
      // Roles are global, not per-company (migration 20260907170000), so
      // looking up 'student' can no longer double as an implicit "does
      // company_id resolve to a real company" check — that's now explicit.
      const company = await tx.company.findFirst({ where: { id: dto.company_id, isDeleted: false } });
      if (!company) {
        throw new BadRequestException('Invalid company');
      }
      const role = await tx.role.findFirst({ where: { name: 'student' } });
      if (!role) {
        throw new BadRequestException('student role not found');
      }

      const category = await tx.category.findFirst({
        where: { id: dto.category_id, companyId: dto.company_id, isDeleted: false },
      });
      if (!category) {
        throw new BadRequestException('Invalid category for this company');
      }

      if (dto.department_id) {
        const department = await tx.department.findFirst({
          where: { id: dto.department_id, companyId: dto.company_id, isDeleted: false },
        });
        if (!department) {
          throw new BadRequestException('Invalid department for this company');
        }
      }

      // specs/014-msg91-sms-otp-mobile-verification — only enforced once
      // MOBILE_VERIFICATION_REQUIRED is flipped on (default false), so this
      // ships and merges before MSG91/DLT template approval completes
      // without blocking registration in the meantime. `username` doubles
      // as the mobile number (register-student.dto.ts), same convention
      // MobileVerification itself is keyed on.
      if (this.configService.get<boolean>('MOBILE_VERIFICATION_REQUIRED')) {
        const verification = await tx.mobileVerification.findFirst({
          where: {
            companyId: dto.company_id,
            mobileNumber: dto.username,
            verificationToken: dto.mobile_verification_token,
          },
        });
        const tokenValid =
          verification !== null &&
          verification.verifiedAt !== null &&
          verification.tokenExpiresAt !== null &&
          verification.tokenExpiresAt.getTime() > Date.now();
        if (!tokenValid) {
          throw new BadRequestException('Mobile number not verified');
        }
        // Single-use — consumed atomically with user.create below (same
        // transaction) so it can never be replayed across two registration
        // attempts.
        await tx.mobileVerification.update({
          where: { id: verification.id },
          data: { verificationToken: null, tokenExpiresAt: null },
        });
      }

      const passwordHash = await this.passwordService.hash(dto.password);

      try {
        // select excludes passwordHash (coding_standard.md §4.4), matching
        // CompaniesService.createCompanyAdmin's own precedent.
        const user = await tx.user.create({
          data: {
            companyId: dto.company_id,
            roleId: role.id,
            name: dto.name,
            username: dto.username,
            passwordHash,
            email: dto.email,
            gender: dto.gender,
            categoryId: dto.category_id,
            departmentId: dto.department_id ?? null,
          },
          select: {
            id: true,
            companyId: true,
            name: true,
            username: true,
            email: true,
            gender: true,
            categoryId: true,
            departmentId: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        return { user, roleName: role.name };
      } catch (error) {
        // FR-013/FR-014: the DB's partial unique index
        // (users_company_username_unique) is the source of truth, avoiding a
        // separate pre-check that would race with a concurrent registration.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          // Broadened wording (was "...within this company"): P2002 can now
          // also come from the cross-partition trigger (a collision with a
          // system_admin's username), which has no "company" in common —
          // this message is accurate for either cause.
          throw new ConflictException('Username already exists');
        }
        throw error;
      }
    });

    const authUser: AuthUser = {
      id: created.user.id,
      companyId: created.user.companyId,
      roleName: created.roleName,
      name: created.user.name,
      username: created.user.username,
    };
    // A separate call/transaction from the row-creation one above, mirroring
    // login()'s own shape (its noOfLoginAttempt update and issueSession call
    // are likewise two separate tenant-context calls, not one nested
    // transaction) — issueSession runs under the newly created user's own
    // real identity (userContext), not the PRE_AUTH_CONTEXT used to create it.
    return this.issueSession(authUser, meta);
  }
}
