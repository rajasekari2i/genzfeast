/**
 * specs/002-registration-login-jwt-auth tasks.md T019 (User Story 4).
 * ACCOUNT_LOCK_THRESHOLD defaults to 5 (env.validation.ts).
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { HttpExceptionFilter } from '../../../src/common/filters/http-exception.filter';
import { PasswordService } from '../../../src/auth/password.service';
import { TenantPrismaService, TenantContext } from '../../../src/common/prisma/tenant-prisma.service';

const superPrisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
const systemAdminCtx: TenantContext = { role: 'system_admin', systemActor: 'test-harness' };
const PASSWORD = 'correct-horse-battery-staple';

async function resetDatabase(): Promise<void> {
  await superPrisma.$executeRawUnsafe(
    'TRUNCATE TABLE refresh_tokens, auth_audit_logs, users, categories, departments, roles, companies CASCADE',
  );
}

describe('Account lockout (specs/002 quickstart.md, User Story 4)', () => {
  let app: INestApplication;
  let passwordService: PasswordService;
  let tenantPrisma: TenantPrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
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

  async function seedStudent(username: string) {
    const company = await tenantPrisma.runInTenantContext(systemAdminCtx, (tx) =>
      tx.company.create({ data: { name: 'Lockout Co', contactPerson: 'P', mobile: `9${username.slice(1)}`, email: 'p@x.com', address: 'X' } }),
    );
    const role = await tenantPrisma.runInTenantContext(systemAdminCtx, (tx) =>
      tx.role.findFirstOrThrow({ where: { name: 'student' } }),
    );
    const passwordHash = await passwordService.hash(PASSWORD);
    const user = await tenantPrisma.runInTenantContext(systemAdminCtx, (tx) =>
      tx.user.create({
        data: { companyId: company.id, roleId: role.id, name: 'S', username, passwordHash, email: 's@x.com' },
      }),
    );
    return { user, company };
  }

  it('locks the account after exactly 5 consecutive failed logins', async () => {
    const { user, company } = await seedStudent('9500000001');

    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: '9500000001', password: 'wrong', company_id: company.id })
        .expect(401);
    }

    const refreshed = await superPrisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(refreshed.status).toBe('locked');
    expect(refreshed.noOfLoginAttempt).toBe(5);
  });

  it('rejects the CORRECT password on a locked account with the locked-specific message, not the generic one', async () => {
    const { company } = await seedStudent('9500000002');
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: '9500000002', password: 'wrong', company_id: company.id })
        .expect(401);
    }

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: '9500000002', password: PASSWORD, company_id: company.id })
      .expect(403);
    expect(res.body.reason).toBe('locked');
  });

  it('revokes a refresh token issued just before lock — it cannot refresh once locked', async () => {
    const { user, company } = await seedStudent('9500000003');
    const session = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: '9500000003', password: PASSWORD, company_id: company.id })
      .expect(200);

    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: '9500000003', password: 'wrong', company_id: company.id })
        .expect(401);
    }
    const refreshed = await superPrisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(refreshed.status).toBe('locked');

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refresh_token: session.body.refresh_token })
      .expect(401);
  });

  it("an already-issued access token keeps working until its own natural expiry, even after lock (stateless JWT — no DB check)", async () => {
    const { company } = await seedStudent('9500000004');
    const session = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: '9500000004', password: PASSWORD, company_id: company.id })
      .expect(200);

    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: '9500000004', password: 'wrong', company_id: company.id })
        .expect(401);
    }

    // Logout only requires a VALID (unexpired) access token via JwtAuthGuard —
    // verification is purely cryptographic, no DB lookup — so the pre-lock
    // access token must still authenticate this request even though the
    // account is now locked.
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${session.body.access_token}`)
      .send({ refresh_token: session.body.refresh_token })
      .expect(204);
  });
});
