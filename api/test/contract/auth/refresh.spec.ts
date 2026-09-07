/**
 * specs/002-registration-login-jwt-auth tasks.md T017 (User Story 3),
 * HTTP-level. The rotation-chain/reuse-detection logic itself is proven in
 * test/unit/token-rotation/rotation.spec.ts; this file proves the endpoint
 * wiring (status codes, body shape) on top of it.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { HttpExceptionFilter } from '../../../src/common/filters/http-exception.filter';
import { AuthService, AuthUser } from '../../../src/auth/auth.service';
import { TenantPrismaService, TenantContext } from '../../../src/common/prisma/tenant-prisma.service';

const superPrisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
const systemAdminCtx: TenantContext = { role: 'system_admin', systemActor: 'test-harness' };

async function resetDatabase(): Promise<void> {
  await superPrisma.$executeRawUnsafe(
    'TRUNCATE TABLE refresh_tokens, auth_audit_logs, users, categories, departments, roles, companies CASCADE',
  );
}

describe('POST /auth/refresh (specs/002 quickstart.md, User Story 3)', () => {
  let app: INestApplication;
  let authService: AuthService;
  let tenantPrisma: TenantPrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    authService = moduleRef.get(AuthService);
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
      tx.company.create({ data: { name: 'Refresh Co', contactPerson: 'P', mobile: '9400000001', email: 'p@x.com', address: 'X' } }),
    );
    const role = await tenantPrisma.runInTenantContext(systemAdminCtx, (tx) =>
      tx.role.findFirstOrThrow({ where: { name: 'student' } }),
    );
    const user = await tenantPrisma.runInTenantContext(systemAdminCtx, (tx) =>
      tx.user.create({
        data: { companyId: company.id, roleId: role.id, name: 'S', username: '9400000099', passwordHash: 'x', email: 's@x.com' },
      }),
    );
    return { id: user.id, companyId: company.id, roleName: 'student', name: user.name, username: user.username };
  }

  it('issues a new working session for a valid refresh token', async () => {
    const user = await seedStudent();
    const session = await authService.issueSession(user, {});

    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refresh_token: session.refresh_token })
      .expect(200);

    expect(res.body.access_token).toEqual(expect.any(String));
    expect(res.body.refresh_token).not.toBe(session.refresh_token);
  });

  it('rejects an unrecognized refresh token with 401', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refresh_token: 'totally-unknown-token' })
      .expect(401);
  });

  it('rejects a reused (already-rotated) refresh token with 401', async () => {
    const user = await seedStudent();
    const session = await authService.issueSession(user, {});
    await authService.refresh(session.refresh_token, {}); // rotate once

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refresh_token: session.refresh_token }) // replay the now-superseded token
      .expect(401);
  });
});
