/**
 * specs/002-registration-login-jwt-auth tasks.md T016 (User Story 3).
 * Exercises AuthService.refresh's rotation chain and reuse (theft)
 * detection directly, independent of the HTTP layer (FR-017, FR-019,
 * research.md §4) — and, per this project's own standing rule, entirely
 * without a database: TenantPrismaService is replaced with an in-memory
 * fake refresh-token store (see createMockTenantPrisma/buildFakeTx below),
 * and every other AuthService dependency is a lightweight jest.fn() stub.
 * This file used to boot the full AppModule against a real Postgres
 * instance despite living under test/unit/ — that's what jest.config.js's
 * "unit" project (no DATABASE_URL, no dotenv) now exists to make
 * structurally impossible to repeat by accident.
 */
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService, AuthUser } from '../../../src/auth/auth.service';
import { TokenService } from '../../../src/auth/token.service';
import { PasswordService } from '../../../src/auth/password.service';
import { AuthAuditService } from '../../../src/auth/auth-audit.service';
import { DevicesService } from '../../../src/devices/devices.service';
import { createMockTenantPrisma } from '../mocks/tenantPrismaMock';

interface FakeRefreshTokenRow {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedBy: string | null;
}

const STUDENT: AuthUser = {
  id: 'user-1',
  companyId: 'company-1',
  roleName: 'student',
  name: 'S',
  username: '9300000099',
};

/**
 * A tiny in-memory double for the one Prisma delegate (`tx.refreshToken`)
 * AuthService.refresh/issueSession/revokeAllSessions actually touch —
 * shaped exactly to the where/data clauses auth.service.ts issues, not a
 * general-purpose Prisma fake.
 */
function buildFakeTx(usersById: Map<string, AuthUser>) {
  const rows = new Map<string, FakeRefreshTokenRow>();
  let nextId = 0;

  return {
    refreshToken: {
      async create({ data }: { data: { userId: string; tokenHash: string; expiresAt: Date } }) {
        const row: FakeRefreshTokenRow = {
          id: `rt-${++nextId}`,
          userId: data.userId,
          tokenHash: data.tokenHash,
          expiresAt: data.expiresAt,
          revokedAt: null,
          replacedBy: null,
        };
        rows.set(row.id, row);
        return row;
      },
      async findUnique({ where }: { where: { tokenHash: string } }) {
        const row = [...rows.values()].find((r) => r.tokenHash === where.tokenHash);
        if (!row) return null;
        const user = usersById.get(row.userId)!;
        return { ...row, user: { ...user, role: { name: user.roleName } } };
      },
      async update({ where, data }: { where: { id: string }; data: Partial<FakeRefreshTokenRow> }) {
        const row = rows.get(where.id)!;
        Object.assign(row, data);
        return row;
      },
      async updateMany({
        where,
        data,
      }: {
        where: { userId: string; revokedAt: null; id?: { not: string } };
        data: Partial<FakeRefreshTokenRow>;
      }) {
        let count = 0;
        for (const row of rows.values()) {
          if (row.userId !== where.userId || row.revokedAt !== null) continue;
          if (where.id?.not && row.id === where.id.not) continue;
          Object.assign(row, data);
          count++;
        }
        return { count };
      },
    },
  };
}

function buildAuthService(usersById: Map<string, AuthUser>) {
  const fakeTx = buildFakeTx(usersById);
  const tenantPrisma = createMockTenantPrisma(fakeTx);

  const configValues: Record<string, unknown> = {
    JWT_ACCESS_TOKEN_TTL_SECONDS: 1800,
    JWT_REFRESH_TOKEN_TTL_DAYS: 14,
  };
  const configService = { getOrThrow: (key: string) => configValues[key] } as unknown as ConfigService;
  // Real TokenService: pure crypto (no DB — see its own file header), so
  // there's no reason to fake it too; a real JwtService just needs a secret.
  const tokenService = new TokenService(new JwtService({ secret: 'test-secret-at-least-32-chars-long' }), configService);
  const passwordService = new PasswordService();
  const authAudit = { refreshReuseDetected: jest.fn() } as unknown as AuthAuditService;
  const devicesService = { deleteSessionLinkedForUser: jest.fn() } as unknown as DevicesService;

  const authService = new AuthService(
    tenantPrisma as never,
    passwordService,
    tokenService,
    authAudit,
    configService,
    {} as never, // OtpService — not on the refresh/issueSession/revokeAllSessions path
    {} as never, // NotificationPort — same
    devicesService,
  );

  return { authService, tokenService, fakeTx };
}

describe('AuthService.refresh — rotation & reuse detection (specs/002 research.md §4)', () => {
  function seedStudent() {
    const usersById = new Map([[STUDENT.id, STUDENT]]);
    return { ...buildAuthService(usersById), user: STUDENT };
  }

  it('rotates through a chain of successive, non-replayed tokens without issue', async () => {
    const { authService, user } = seedStudent();
    const first = await authService.issueSession(user, {});

    const rotated = await authService.refresh(first.refresh_token, {});
    expect(rotated.refresh_token).not.toBe(first.refresh_token);

    // Rotating again — using the NEW token, never replaying the old one —
    // must keep working indefinitely down the chain.
    const rotatedAgain = await authService.refresh(rotated.refresh_token, {});
    expect(rotatedAgain.access_token).toEqual(expect.any(String));
    expect(rotatedAgain.refresh_token).not.toBe(rotated.refresh_token);
  });

  it('the old token becomes unusable immediately after rotation (replaying it is covered by the reuse-detection test below)', async () => {
    const { authService, user } = seedStudent();
    const first = await authService.issueSession(user, {});
    await authService.refresh(first.refresh_token, {});

    await expect(authService.refresh(first.refresh_token, {})).rejects.toThrow(UnauthorizedException);
  });

  it('replaying an already-rotated token revokes EVERY session for that user (FR-017)', async () => {
    const { authService, user } = seedStudent();
    const sessionA = await authService.issueSession(user, {}); // device A
    const sessionB = await authService.issueSession(user, {}); // device B

    // Device A rotates normally.
    await authService.refresh(sessionA.refresh_token, {});

    // The old (now-superseded) device-A token is replayed — a theft signal.
    await expect(authService.refresh(sessionA.refresh_token, {})).rejects.toThrow(UnauthorizedException);

    // Device B's still-independently-valid token must ALSO now be dead —
    // reuse revokes every session for the account, not just the one reused.
    await expect(authService.refresh(sessionB.refresh_token, {})).rejects.toThrow(UnauthorizedException);
  });

  it('two independently-issued sessions rotate independently of one another until reuse occurs', async () => {
    const { authService, user } = seedStudent();
    const sessionA = await authService.issueSession(user, {});
    const sessionB = await authService.issueSession(user, {});

    const rotatedA = await authService.refresh(sessionA.refresh_token, {});
    const rotatedB = await authService.refresh(sessionB.refresh_token, {});

    expect(rotatedA.access_token).not.toBe(rotatedB.access_token);
    // Both remain independently valid — proves rotating one didn't disturb the other.
    await expect(authService.refresh(rotatedA.refresh_token, {})).resolves.toBeDefined();
    await expect(authService.refresh(rotatedB.refresh_token, {})).resolves.toBeDefined();
  });

  it('rejects an expired refresh token', async () => {
    const { authService, tokenService, fakeTx } = seedStudent();
    const session = await authService.issueSession(STUDENT, {});

    // Reach into the fake store directly to backdate expiry — the
    // equivalent of the old test's `superPrisma.refreshToken.update(...)`,
    // just against the in-memory fake instead of a real row.
    const tokenHash = tokenService.hashRefreshToken(session.refresh_token);
    const found = await fakeTx.refreshToken.findUnique({ where: { tokenHash } });
    await fakeTx.refreshToken.update({ where: { id: found!.id }, data: { expiresAt: new Date(Date.now() - 1000) } });

    await expect(authService.refresh(session.refresh_token, {})).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a malformed/unrecognized refresh token', async () => {
    const { authService } = seedStudent();
    await expect(authService.refresh('not-a-real-token', {})).rejects.toThrow(UnauthorizedException);
  });
});
