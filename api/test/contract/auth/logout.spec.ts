/**
 * specs/002-registration-login-jwt-auth tasks.md T022 (User Story 5).
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { HttpExceptionFilter } from '../../../src/common/filters/http-exception.filter';
import { AuthService, AuthUser } from '../../../src/auth/auth.service';
import { PasswordService } from '../../../src/auth/password.service';
import { TenantPrismaService, TenantContext } from '../../../src/common/prisma/tenant-prisma.service';

const superPrisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
const systemAdminCtx: TenantContext = { role: 'system_admin', systemActor: 'test-harness' };

async function resetDatabase(): Promise<void> {
  await superPrisma.$executeRawUnsafe(
    'TRUNCATE TABLE refresh_tokens, auth_audit_logs, users, categories, departments, roles, companies CASCADE',
  );
}

describe('POST /auth/logout (specs/002 quickstart.md, User Story 5)', () => {
  let app: INestApplication;
  let authService: AuthService;
  let passwordService: PasswordService;
  let tenantPrisma: TenantPrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    authService = moduleRef.get(AuthService);
    passwordService = moduleRef.get(PasswordService);
    tenantPrisma = moduleRef.get(TenantPrismaService);
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await app.close();
    await tenantPrisma.disconnect();
    await superPrisma.$disconnect();
  });

  async function seedStudent(): Promise<AuthUser> {
    const company = await tenantPrisma.runInTenantContext(systemAdminCtx, (tx) =>
      tx.company.create({ data: { name: 'Logout Co', contactPerson: 'P', mobile: '9600000001', email: 'p@x.com', address: 'X' } }),
    );
    const role = await tenantPrisma.runInTenantContext(systemAdminCtx, (tx) =>
      tx.role.findFirstOrThrow({ where: { name: 'student' } }),
    );
    const passwordHash = await passwordService.hash('irrelevant');
    const user = await tenantPrisma.runInTenantContext(systemAdminCtx, (tx) =>
      tx.user.create({
        data: { companyId: company.id, roleId: role.id, name: 'S', username: '9600000099', passwordHash, email: 's@x.com' },
      }),
    );
    return { id: user.id, companyId: company.id, roleName: 'student', name: user.name, username: user.username };
  }

  it("logs out one session without affecting a second device's session (FR-011, FR-019)", async () => {
    const user = await seedStudent();
    const deviceA = await authService.issueSession(user, {});
    const deviceB = await authService.issueSession(user, {});

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${deviceA.access_token}`)
      .send({ refresh_token: deviceA.refresh_token })
      .expect(204);

    // Device A can no longer refresh...
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refresh_token: deviceA.refresh_token })
      .expect(401);

    // ...but Device B is completely unaffected.
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refresh_token: deviceB.refresh_token })
      .expect(200);
  });

  it('the logged-out session\'s access token still authorizes one more request before its own natural expiry', async () => {
    const user = await seedStudent();
    const session = await authService.issueSession(user, {});

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${session.access_token}`)
      .send({ refresh_token: session.refresh_token })
      .expect(204);

    // A second logout call with the SAME (still cryptographically valid)
    // access token is still authorized by the guard — it just finds nothing
    // left to revoke (idempotent no-op), proving the access token itself
    // wasn't invalidated by the logout action.
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${session.access_token}`)
      .send({ refresh_token: session.refresh_token })
      .expect(204);
  });

  it('rejects logout with no Authorization header (401)', async () => {
    await request(app.getHttpServer()).post('/auth/logout').send({ refresh_token: 'irrelevant' }).expect(401);
  });
});
