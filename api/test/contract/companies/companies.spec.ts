/**
 * Contract tests for specs/001-company-role-user-setup's System Admin
 * Company endpoints (coding_standard.md §9: "a quickstart.md scenario that
 * isn't backed by an automated test is a gap"). Covers
 * specs/001-company-role-user-setup/quickstart.md Scenario 1, steps 1/2/4
 * (Company create + role-seeding trigger, PATCH/toggle, create first
 * Company Admin) plus the 401/403/400/404/409 boundaries.
 *
 * Boots the real Nest app (AppModule) against the real Supabase database —
 * same discipline as test/rls: this proves the actual wiring (guards,
 * interceptor, TenantPrismaService, RLS) works end-to-end, not a mocked
 * substitute.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { HttpExceptionFilter } from '../../../src/common/filters/http-exception.filter';

const superPrisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });

async function resetDatabase(): Promise<void> {
  // Superuser cleanup only, same as test/rls — app_user is never granted
  // DELETE (soft-delete convention, coding_standard.md §4.4).
  await superPrisma.$executeRawUnsafe(
    'TRUNCATE TABLE users, categories, departments, roles, companies CASCADE',
  );
}

function validCompanyPayload() {
  return {
    name: 'Test Canteen',
    contact_person: 'Jane Doe',
    mobile: '9000000000',
    email: 'jane@example.com',
    address: '123 Campus Road',
  };
}

describe('Companies contract (specs/001 quickstart.md Scenario 1)', () => {
  let app: INestApplication;
  let systemAdminToken: string;
  let companyAdminToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    const jwtService = app.get(JwtService);
    systemAdminToken = jwtService.sign({ sub: randomUUID(), role: 'system_admin', company_id: null });
    companyAdminToken = jwtService.sign({
      sub: randomUUID(),
      role: 'company_admin',
      company_id: randomUUID(),
    });
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await app.close();
    await superPrisma.$disconnect();
  });

  it('rejects a request with no Authorization header (401)', async () => {
    await request(app.getHttpServer()).get('/admin/companies').expect(401);
  });

  it('rejects a non-system_admin caller (403)', async () => {
    await request(app.getHttpServer())
      .get('/admin/companies')
      .set('Authorization', `Bearer ${companyAdminToken}`)
      .expect(403);
  });

  it('creates a company as system_admin (roles are global, not seeded per-company)', async () => {
    const res = await request(app.getHttpServer())
      .post('/admin/companies')
      .set('Authorization', `Bearer ${systemAdminToken}`)
      .send(validCompanyPayload())
      .expect(201);

    expect(res.body.id).toEqual(expect.any(String));
    expect(res.body.is_open).toBe(true);
    expect(res.body.name).toBe('Test Canteen');

    // Roles are global (migration 20260907170000) — creating a company
    // seeds nothing into `roles`; the shared catalog already has these.
    const roles = await superPrisma.role.findMany({ where: { name: { in: ['company_admin', 'company_staff', 'student'] } } });
    expect(roles.map((r) => r.name).sort()).toEqual(['company_admin', 'company_staff', 'student']);
  });

  it('rejects a company create request missing a required field (400)', async () => {
    const { email: _email, ...incomplete } = validCompanyPayload();
    await request(app.getHttpServer())
      .post('/admin/companies')
      .set('Authorization', `Bearer ${systemAdminToken}`)
      .send(incomplete)
      .expect(400);
  });

  it('rejects an unrecognized field in the request body (400, whitelist/forbidNonWhitelisted)', async () => {
    await request(app.getHttpServer())
      .post('/admin/companies')
      .set('Authorization', `Bearer ${systemAdminToken}`)
      .send({ ...validCompanyPayload(), unexpected_field: 'nope' })
      .expect(400);
  });

  it('lists companies as system_admin', async () => {
    await request(app.getHttpServer())
      .post('/admin/companies')
      .set('Authorization', `Bearer ${systemAdminToken}`)
      .send(validCompanyPayload())
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/admin/companies')
      .set('Authorization', `Bearer ${systemAdminToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
  });

  it('toggles is_open via PATCH, leaving other fields untouched (PATCH semantics)', async () => {
    const created = await request(app.getHttpServer())
      .post('/admin/companies')
      .set('Authorization', `Bearer ${systemAdminToken}`)
      .send(validCompanyPayload())
      .expect(201);

    const patched = await request(app.getHttpServer())
      .patch(`/admin/companies/${created.body.id}`)
      .set('Authorization', `Bearer ${systemAdminToken}`)
      .send({ is_open: false })
      .expect(200);

    expect(patched.body.is_open).toBe(false);
    expect(patched.body.name).toBe('Test Canteen');
  });

  it('returns 404 for PATCH on a non-existent company', async () => {
    await request(app.getHttpServer())
      .patch(`/admin/companies/${randomUUID()}`)
      .set('Authorization', `Bearer ${systemAdminToken}`)
      .send({ is_open: false })
      .expect(404);
  });

  it('creates the first Company Admin for a company', async () => {
    const created = await request(app.getHttpServer())
      .post('/admin/companies')
      .set('Authorization', `Bearer ${systemAdminToken}`)
      .send(validCompanyPayload())
      .expect(201);

    const admin = await request(app.getHttpServer())
      .post(`/admin/companies/${created.body.id}/admins`)
      .set('Authorization', `Bearer ${systemAdminToken}`)
      .send({
        name: 'Alice Admin',
        username: '9111111111',
        password: 'temporary123',
        email: 'alice@example.com',
      })
      .expect(201);

    expect(admin.body.role).toBe('company_admin');
    expect(admin.body.company_id).toBe(created.body.id);
    expect(admin.body).not.toHaveProperty('password_hash');
    expect(admin.body).not.toHaveProperty('passwordHash');
  });

  it('rejects a duplicate username within the same company (409)', async () => {
    const created = await request(app.getHttpServer())
      .post('/admin/companies')
      .set('Authorization', `Bearer ${systemAdminToken}`)
      .send(validCompanyPayload())
      .expect(201);

    const adminPayload = {
      name: 'Alice Admin',
      username: '9111111111',
      password: 'temporary123',
      email: 'alice@example.com',
    };

    await request(app.getHttpServer())
      .post(`/admin/companies/${created.body.id}/admins`)
      .set('Authorization', `Bearer ${systemAdminToken}`)
      .send(adminPayload)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/admin/companies/${created.body.id}/admins`)
      .set('Authorization', `Bearer ${systemAdminToken}`)
      .send(adminPayload)
      .expect(409);
  });
});
