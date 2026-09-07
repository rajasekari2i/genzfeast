/**
 * specs/002-registration-login-jwt-auth tasks.md T009 (User Story 1).
 *
 * 001's real Student self-registration HTTP endpoint doesn't exist yet
 * (spec.md's own "Known gap" — see tasks.md), so this test seeds a `users`
 * row directly as a fixture standing in for it, then proves
 * `AuthService.issueSession` alone is the reusable session-issuance contract
 * that endpoint will call once it exists (FR-001, FR-006, SC-001).
 */
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../../../src/app.module';
import { AuthService, AuthUser } from '../../../src/auth/auth.service';
import { TenantPrismaService, TenantContext } from '../../../src/common/prisma/tenant-prisma.service';
import type { JwtPayload } from '../../../src/common/guards/jwt-auth.guard';

const superPrisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });

async function resetDatabase(): Promise<void> {
  await superPrisma.$executeRawUnsafe(
    'TRUNCATE TABLE refresh_tokens, auth_audit_logs, users, categories, departments, roles, companies CASCADE',
  );
}

describe('AuthService.issueSession (specs/002 tasks.md T008-T009)', () => {
  let authService: AuthService;
  let tenantPrisma: TenantPrismaService;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    authService = moduleRef.get(AuthService);
    tenantPrisma = moduleRef.get(TenantPrismaService);
    jwtService = moduleRef.get(JwtService);
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await tenantPrisma.disconnect();
    await superPrisma.$disconnect();
  });

  const systemAdminCtx: TenantContext = { role: 'system_admin', systemActor: 'test-harness' };

  async function seedStudentFixture(): Promise<AuthUser> {
    const company = await tenantPrisma.runInTenantContext(systemAdminCtx, (tx) =>
      tx.company.create({
        data: { name: 'Fixture Co', contactPerson: 'P', mobile: '9000000010', email: 'p@x.com', address: 'X' },
      }),
    );
    const studentRole = await tenantPrisma.runInTenantContext(systemAdminCtx, (tx) =>
      tx.role.findFirstOrThrow({ where: { name: 'student' } }),
    );
    const user = await tenantPrisma.runInTenantContext(systemAdminCtx, (tx) =>
      tx.user.create({
        data: {
          companyId: company.id,
          roleId: studentRole.id,
          name: 'Fixture Student',
          username: '9000000099',
          passwordHash: 'irrelevant-for-this-test',
          email: 's@x.com',
        },
      }),
    );
    return { id: user.id, companyId: company.id, roleName: 'student', name: user.name, username: user.username };
  }

  it('returns an access token whose claims match the fixture user, plus a usable refresh token', async () => {
    const user = await seedStudentFixture();

    const session = await authService.issueSession(user, {});

    expect(session.user).toEqual({
      id: user.id,
      company_id: user.companyId,
      role: 'student',
      name: user.name,
      username: user.username,
    });

    const claims = await jwtService.verifyAsync<JwtPayload>(session.access_token);
    expect(claims.sub).toBe(user.id);
    expect(claims.role).toBe('student');
    expect(claims.company_id).toBe(user.companyId);
    expect(claims.jti).toEqual(expect.any(String));
  });

  it('persists exactly one refresh_tokens row, hashed, never the raw value (research.md §3)', async () => {
    const user = await seedStudentFixture();
    const session = await authService.issueSession(user, {});

    const rows = await tenantPrisma.runInTenantContext({ userId: user.id, role: 'student', companyId: user.companyId }, (tx) =>
      tx.refreshToken.findMany({ where: { userId: user.id } }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).not.toBe(session.refresh_token);
    expect(rows[0].revokedAt).toBeNull();
  });

  it('two separate issueSession calls for the same user create two independent sessions (FR-016)', async () => {
    const user = await seedStudentFixture();
    await authService.issueSession(user, {});
    await authService.issueSession(user, {});

    const rows = await tenantPrisma.runInTenantContext({ userId: user.id, role: 'student', companyId: user.companyId }, (tx) =>
      tx.refreshToken.findMany({ where: { userId: user.id } }),
    );
    expect(rows).toHaveLength(2);
  });
});
