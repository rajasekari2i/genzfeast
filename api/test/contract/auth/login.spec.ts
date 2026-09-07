/**
 * specs/002-registration-login-jwt-auth tasks.md T013 (User Story 2).
 * Covers quickstart.md's login scenarios end-to-end over real HTTP against
 * the real Supabase database (same discipline as test/contract/companies).
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

describe('POST /auth/login (specs/002 quickstart.md, User Story 2)', () => {
  let app: INestApplication;
  let tenantPrisma: TenantPrismaService;
  let passwordService: PasswordService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    tenantPrisma = moduleRef.get(TenantPrismaService);
    passwordService = moduleRef.get(PasswordService);
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await app.close();
    await tenantPrisma.disconnect();
    await superPrisma.$disconnect();
  });

  async function seedCompany(overrides: Partial<{ isOpen: boolean }> = {}) {
    return tenantPrisma.runInTenantContext(systemAdminCtx, (tx) =>
      tx.company.create({
        data: {
          name: 'Login Test Co',
          contactPerson: 'P',
          mobile: '9100000001',
          email: 'p@x.com',
          address: 'X',
          isOpen: overrides.isOpen ?? true,
        },
      }),
    );
  }

  async function seedUser(companyId: string | null, roleName: string, username: string, status = 'active') {
    const passwordHash = await passwordService.hash(PASSWORD);
    if (companyId === null) {
      // Roles are global, not per-company (migration 20260907170000) — the
      // migration itself seeds system_admin, so this is a plain lookup, not
      // the find-or-create workaround this used to need.
      const role = await superPrisma.role.findFirstOrThrow({ where: { name: 'system_admin' } });
      return tenantPrisma.runInTenantContext(systemAdminCtx, (tx) =>
        tx.user.create({
          data: { companyId: null, roleId: role.id, name: 'Sys Admin', username, passwordHash, email: 'sa@x.com', status },
        }),
      );
    }
    const role = await tenantPrisma.runInTenantContext(systemAdminCtx, (tx) =>
      tx.role.findFirstOrThrow({ where: { name: roleName } }),
    );
    return tenantPrisma.runInTenantContext(systemAdminCtx, (tx) =>
      tx.user.create({
        data: { companyId, roleId: role.id, name: 'Fixture User', username, passwordHash, email: 'u@x.com', status },
      }),
    );
  }

  it.each(['company_admin', 'company_staff', 'student'])(
    'logs in a %s with company_id + username + password',
    async (roleName) => {
      const company = await seedCompany();
      await seedUser(company.id, roleName, '9200000001');

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: '9200000001', password: PASSWORD, company_id: company.id })
        .expect(200);

      expect(res.body.user.role).toBe(roleName);
      expect(res.body.access_token).toEqual(expect.any(String));
      expect(res.body.refresh_token).toEqual(expect.any(String));
    },
  );

  it('logs in system_admin with username + password and no company_id', async () => {
    await seedUser(null, 'system_admin', '9200000099');

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: '9200000099', password: PASSWORD })
      .expect(200);

    expect(res.body.user.role).toBe('system_admin');
    expect(res.body.user.company_id).toBeNull();
  });

  it('rejects an unknown username with the generic 401 message', async () => {
    const company = await seedCompany();
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: '9999999999', password: PASSWORD, company_id: company.id })
      .expect(401);
    expect(res.body.message).toBe('Invalid username or password');
  });

  it('rejects a wrong password with the identical generic 401 message', async () => {
    const company = await seedCompany();
    await seedUser(company.id, 'student', '9200000002');
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: '9200000002', password: 'wrong-password', company_id: company.id })
      .expect(401);
    expect(res.body.message).toBe('Invalid username or password');
  });

  it('rejects a username that exists only under a DIFFERENT company_id, identically to not-found (spec.md Clarifications)', async () => {
    const companyA = await seedCompany();
    const companyB = await tenantPrisma.runInTenantContext(systemAdminCtx, (tx) =>
      tx.company.create({ data: { name: 'Co B', contactPerson: 'B', mobile: '9100000002', email: 'b@x.com', address: 'X' } }),
    );
    await seedUser(companyA.id, 'student', '9200000003');

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: '9200000003', password: PASSWORD, company_id: companyB.id })
      .expect(401);
    expect(res.body.message).toBe('Invalid username or password');
  });

  it('rejects a locked account even with the correct password, with a distinct 403 + reason', async () => {
    const company = await seedCompany();
    await seedUser(company.id, 'student', '9200000004', 'locked');
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: '9200000004', password: PASSWORD, company_id: company.id })
      .expect(403);
    expect(res.body.reason).toBe('locked');
  });

  it('rejects an inactive account even with the correct password, with a distinct 403 + reason', async () => {
    const company = await seedCompany();
    await seedUser(company.id, 'student', '9200000005', 'inactive');
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: '9200000005', password: PASSWORD, company_id: company.id })
      .expect(403);
    expect(res.body.reason).toBe('inactive');
  });

  it('resets no_of_login_attempt to 0 after a successful login', async () => {
    const company = await seedCompany();
    const user = await seedUser(company.id, 'student', '9200000006');
    await tenantPrisma.runInTenantContext(systemAdminCtx, (tx) =>
      tx.user.update({ where: { id: user.id }, data: { noOfLoginAttempt: 3 } }),
    );

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: '9200000006', password: PASSWORD, company_id: company.id })
      .expect(200);

    const refreshed = await superPrisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(refreshed.noOfLoginAttempt).toBe(0);
  });

  it('succeeds for a Student whose Company is closed (is_open: false) — closed blocks ordering only', async () => {
    const company = await seedCompany({ isOpen: false });
    await seedUser(company.id, 'student', '9200000007');

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: '9200000007', password: PASSWORD, company_id: company.id })
      .expect(200);
  });
});
