/**
 * Direct-DB RLS tests (coding_standard.md §9): these connect as `app_user`
 * (the non-superuser application role created in the migration), NEVER as
 * the migration/superuser role — RLS is meaningless against a superuser or
 * the table owner, both of which bypass it entirely. This is what actually
 * proves the policies work, independent of any API-layer scoping.
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { TenantPrismaService, TenantContext } from '../../src/common/prisma/tenant-prisma.service';

const appPrisma = new PrismaClient({ datasourceUrl: process.env.APP_DATABASE_URL });
const superPrisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
const tenantDb = new TenantPrismaService(appPrisma);

const systemAdminCtx: TenantContext = { role: 'system_admin', systemActor: 'test-harness' };
const ctxFor = (companyId: string, role: string, userId?: string): TenantContext => ({
  role,
  companyId,
  userId,
});

async function resetDatabase() {
  // Superuser cleanup only — app_user is never granted DELETE (soft-delete
  // convention, coding_standard.md §4.4); this is test-infra teardown, not
  // something the application itself is allowed to do.
  await superPrisma.$executeRawUnsafe(
    'TRUNCATE TABLE refresh_tokens, auth_audit_logs, users, categories, departments, roles, companies CASCADE',
  );
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await tenantDb.disconnect();
  await superPrisma.$disconnect();
});

describe('Company RLS — system_admin only (data-model.md, companies_system_admin_only)', () => {
  it('lets system_admin create a company', async () => {
    const company = await tenantDb.runInTenantContext(systemAdminCtx, (tx) =>
      tx.company.create({
        data: { name: 'Test Canteen', contactPerson: 'Alice', mobile: '9000000001', email: 'a@test.com', address: 'Campus' },
      }),
    );
    expect(company.id).toBeDefined();
  });

  it('does not seed any new role rows on company creation (roles are global, migration 20260907170000)', async () => {
    const before = await tenantDb.runInTenantContext(systemAdminCtx, (tx) => tx.role.count());
    await tenantDb.runInTenantContext(systemAdminCtx, (tx) =>
      tx.company.create({
        data: { name: 'Trigger Canteen', contactPerson: 'Bob', mobile: '9000000002', email: 'b@test.com', address: 'Campus' },
      }),
    );
    const after = await tenantDb.runInTenantContext(systemAdminCtx, (tx) => tx.role.count());
    expect(after).toBe(before);
  });

  it('denies a non-system_admin role from seeing any company row', async () => {
    const company = await tenantDb.runInTenantContext(systemAdminCtx, (tx) =>
      tx.company.create({
        data: { name: 'Hidden Canteen', contactPerson: 'Carol', mobile: '9000000003', email: 'c@test.com', address: 'Campus' },
      }),
    );
    const asCompanyAdmin = await tenantDb.runInTenantContext(ctxFor(company.id, 'company_admin'), (tx) =>
      tx.company.findMany(),
    );
    expect(asCompanyAdmin).toHaveLength(0);
  });

  it('denies a non-system_admin role from creating a company', async () => {
    await expect(
      tenantDb.runInTenantContext(ctxFor(randomUUID(), 'company_admin'), (tx) =>
        tx.company.create({
          data: { name: 'Rogue Canteen', contactPerson: 'Mallory', mobile: '9000000004', email: 'm@test.com', address: 'Campus' },
        }),
      ),
    ).rejects.toThrow();
  });
});

describe('Category/Department RLS — tenant isolation + system_admin bypass (FR-005/FR-021)', () => {
  async function seedTwoCompanies() {
    const [companyA, companyB] = await Promise.all([
      tenantDb.runInTenantContext(systemAdminCtx, (tx) =>
        tx.company.create({ data: { name: 'Company A', contactPerson: 'A', mobile: '9111111111', email: 'a@x.com', address: 'X' } }),
      ),
      tenantDb.runInTenantContext(systemAdminCtx, (tx) =>
        tx.company.create({ data: { name: 'Company B', contactPerson: 'B', mobile: '9222222222', email: 'b@x.com', address: 'X' } }),
      ),
    ]);
    return { companyA, companyB };
  }

  it('lets a company_admin create a category scoped to their own company', async () => {
    const { companyA } = await seedTwoCompanies();
    const category = await tenantDb.runInTenantContext(ctxFor(companyA.id, 'company_admin'), (tx) =>
      tx.category.create({ data: { companyId: companyA.id, name: 'Student' } }),
    );
    expect(category.companyId).toBe(companyA.id);
  });

  it('never shows Company A categories to Company B (cross-tenant isolation)', async () => {
    const { companyA, companyB } = await seedTwoCompanies();
    await tenantDb.runInTenantContext(ctxFor(companyA.id, 'company_admin'), (tx) =>
      tx.category.create({ data: { companyId: companyA.id, name: 'Student' } }),
    );
    const asCompanyB = await tenantDb.runInTenantContext(ctxFor(companyB.id, 'company_admin'), (tx) =>
      tx.category.findMany(),
    );
    expect(asCompanyB).toHaveLength(0);
  });

  it('rejects a company_admin trying to insert a category under a DIFFERENT company_id (WITH CHECK)', async () => {
    const { companyA, companyB } = await seedTwoCompanies();
    await expect(
      tenantDb.runInTenantContext(ctxFor(companyA.id, 'company_admin'), (tx) =>
        tx.category.create({ data: { companyId: companyB.id, name: 'Smuggled' } }),
      ),
    ).rejects.toThrow();
  });

  it('lets system_admin see and manage every company\'s categories (full cross-tenant CRUD)', async () => {
    const { companyA, companyB } = await seedTwoCompanies();
    await tenantDb.runInTenantContext(ctxFor(companyA.id, 'company_admin'), (tx) =>
      tx.category.create({ data: { companyId: companyA.id, name: 'Student' } }),
    );
    await tenantDb.runInTenantContext(ctxFor(companyB.id, 'company_admin'), (tx) =>
      tx.category.create({ data: { companyId: companyB.id, name: 'Teaching Staff' } }),
    );
    const allCategories = await tenantDb.runInTenantContext(systemAdminCtx, (tx) => tx.category.findMany());
    expect(allCategories).toHaveLength(2);
  });

  it('enforces case-insensitive per-company uniqueness among non-removed categories', async () => {
    const { companyA } = await seedTwoCompanies();
    await tenantDb.runInTenantContext(ctxFor(companyA.id, 'company_admin'), (tx) =>
      tx.category.create({ data: { companyId: companyA.id, name: 'Student' } }),
    );
    await expect(
      tenantDb.runInTenantContext(ctxFor(companyA.id, 'company_admin'), (tx) =>
        tx.category.create({ data: { companyId: companyA.id, name: 'student' } }),
      ),
    ).rejects.toThrow();
  });

  it('allows reusing a name after the original category is soft-deleted', async () => {
    const { companyA } = await seedTwoCompanies();
    const original = await tenantDb.runInTenantContext(ctxFor(companyA.id, 'company_admin'), (tx) =>
      tx.category.create({ data: { companyId: companyA.id, name: 'Student' } }),
    );
    await tenantDb.runInTenantContext(ctxFor(companyA.id, 'company_admin'), (tx) =>
      tx.category.update({ where: { id: original.id }, data: { isDeleted: true } }),
    );
    const recreated = await tenantDb.runInTenantContext(ctxFor(companyA.id, 'company_admin'), (tx) =>
      tx.category.create({ data: { companyId: companyA.id, name: 'Student' } }),
    );
    expect(recreated.id).not.toBe(original.id);
  });
});

describe('Department RLS — tenant isolation + system_admin bypass (independent of Category, same policy shape)', () => {
  async function seedTwoCompanies() {
    const [companyA, companyB] = await Promise.all([
      tenantDb.runInTenantContext(systemAdminCtx, (tx) =>
        tx.company.create({ data: { name: 'Dept Co A', contactPerson: 'A', mobile: '9666666661', email: 'da@x.com', address: 'X' } }),
      ),
      tenantDb.runInTenantContext(systemAdminCtx, (tx) =>
        tx.company.create({ data: { name: 'Dept Co B', contactPerson: 'B', mobile: '9666666662', email: 'db@x.com', address: 'X' } }),
      ),
    ]);
    return { companyA, companyB };
  }

  it('never shows Company A departments to Company B', async () => {
    const { companyA, companyB } = await seedTwoCompanies();
    await tenantDb.runInTenantContext(ctxFor(companyA.id, 'company_admin'), (tx) =>
      tx.department.create({ data: { companyId: companyA.id, name: 'Computer Science' } }),
    );
    const asCompanyB = await tenantDb.runInTenantContext(ctxFor(companyB.id, 'company_admin'), (tx) =>
      tx.department.findMany(),
    );
    expect(asCompanyB).toHaveLength(0);
  });

  it('rejects inserting a department under a DIFFERENT company_id (WITH CHECK)', async () => {
    const { companyA, companyB } = await seedTwoCompanies();
    await expect(
      tenantDb.runInTenantContext(ctxFor(companyA.id, 'company_admin'), (tx) =>
        tx.department.create({ data: { companyId: companyB.id, name: 'Smuggled Dept' } }),
      ),
    ).rejects.toThrow();
  });

  it('lets system_admin see every company\'s departments (full cross-tenant CRUD)', async () => {
    const { companyA, companyB } = await seedTwoCompanies();
    await tenantDb.runInTenantContext(ctxFor(companyA.id, 'company_admin'), (tx) =>
      tx.department.create({ data: { companyId: companyA.id, name: 'CS' } }),
    );
    await tenantDb.runInTenantContext(ctxFor(companyB.id, 'company_admin'), (tx) =>
      tx.department.create({ data: { companyId: companyB.id, name: 'ECE' } }),
    );
    const all = await tenantDb.runInTenantContext(systemAdminCtx, (tx) => tx.department.findMany());
    expect(all).toHaveLength(2);
  });

  it('enforces case-insensitive per-company uniqueness among non-removed departments', async () => {
    const { companyA } = await seedTwoCompanies();
    await tenantDb.runInTenantContext(ctxFor(companyA.id, 'company_admin'), (tx) =>
      tx.department.create({ data: { companyId: companyA.id, name: 'Computer Science' } }),
    );
    await expect(
      tenantDb.runInTenantContext(ctxFor(companyA.id, 'company_admin'), (tx) =>
        tx.department.create({ data: { companyId: companyA.id, name: 'computer science' } }),
      ),
    ).rejects.toThrow();
  });
});

describe('User RLS — tenant isolation, per-company username uniqueness, roles readability', () => {
  async function seedCompanyWithAdminRole() {
    const company = await tenantDb.runInTenantContext(systemAdminCtx, (tx) =>
      tx.company.create({ data: { name: 'Co', contactPerson: 'P', mobile: '9333333333', email: 'p@x.com', address: 'X' } }),
    );
    const companyAdminRole = await tenantDb.runInTenantContext(systemAdminCtx, (tx) =>
      tx.role.findFirstOrThrow({ where: { name: 'company_admin' } }),
    );
    return { company, companyAdminRole };
  }

  it('lets system_admin create the first Company Admin user for a company', async () => {
    const { company, companyAdminRole } = await seedCompanyWithAdminRole();
    const admin = await tenantDb.runInTenantContext(systemAdminCtx, (tx) =>
      tx.user.create({
        data: {
          companyId: company.id,
          roleId: companyAdminRole.id,
          name: 'Admin One',
          username: '9800000001',
          passwordHash: 'not-a-real-hash',
          email: 'admin1@x.com',
        },
      }),
    );
    expect(admin.companyId).toBe(company.id);
  });

  it('never shows one company\'s users to another company\'s company_admin', async () => {
    const { company, companyAdminRole } = await seedCompanyWithAdminRole();
    await tenantDb.runInTenantContext(systemAdminCtx, (tx) =>
      tx.user.create({
        data: {
          companyId: company.id,
          roleId: companyAdminRole.id,
          name: 'Admin One',
          username: '9800000002',
          passwordHash: 'x',
          email: 'admin2@x.com',
        },
      }),
    );
    const otherCompany = await tenantDb.runInTenantContext(systemAdminCtx, (tx) =>
      tx.company.create({ data: { name: 'Other', contactPerson: 'O', mobile: '9444444444', email: 'o@x.com', address: 'X' } }),
    );
    const asOtherCompanyAdmin = await tenantDb.runInTenantContext(ctxFor(otherCompany.id, 'company_admin'), (tx) =>
      tx.user.findMany(),
    );
    expect(asOtherCompanyAdmin).toHaveLength(0);
  });

  it('allows the SAME username at two different companies (per-tenant uniqueness, not global)', async () => {
    const { company: companyA, companyAdminRole: roleA } = await seedCompanyWithAdminRole();
    const companyB = await tenantDb.runInTenantContext(systemAdminCtx, (tx) =>
      tx.company.create({ data: { name: 'B', contactPerson: 'B', mobile: '9555555555', email: 'bb@x.com', address: 'X' } }),
    );
    const roleB = await tenantDb.runInTenantContext(systemAdminCtx, (tx) =>
      tx.role.findFirstOrThrow({ where: { name: 'company_admin' } }),
    );
    const sharedUsername = '9600158225';
    await tenantDb.runInTenantContext(systemAdminCtx, (tx) =>
      tx.user.create({
        data: { companyId: companyA.id, roleId: roleA.id, name: 'A', username: sharedUsername, passwordHash: 'x', email: 'x@a.com' },
      }),
    );
    // Should NOT throw — same username, different company.
    const userB = await tenantDb.runInTenantContext(systemAdminCtx, (tx) =>
      tx.user.create({
        data: { companyId: companyB.id, roleId: roleB.id, name: 'B', username: sharedUsername, passwordHash: 'x', email: 'x@b.com' },
      }),
    );
    expect(userB.username).toBe(sharedUsername);
  });

  it('rejects a duplicate username within the SAME company', async () => {
    const { company, companyAdminRole } = await seedCompanyWithAdminRole();
    await tenantDb.runInTenantContext(systemAdminCtx, (tx) =>
      tx.user.create({
        data: { companyId: company.id, roleId: companyAdminRole.id, name: 'A', username: '9700000001', passwordHash: 'x', email: 'x1@a.com' },
      }),
    );
    await expect(
      tenantDb.runInTenantContext(systemAdminCtx, (tx) =>
        tx.user.create({
          data: { companyId: company.id, roleId: companyAdminRole.id, name: 'A2', username: '9700000001', passwordHash: 'x', email: 'x2@a.com' },
        }),
      ),
    ).rejects.toThrow();
  });

  it('lets a company_admin read the global role list (to assign roles) but never write to it', async () => {
    const { company } = await seedCompanyWithAdminRole();
    const roles = await tenantDb.runInTenantContext(ctxFor(company.id, 'company_admin'), (tx) => tx.role.findMany());
    // Global, not per-company (migration 20260907170000) — every role in
    // the platform-wide catalog, not just this company's own set.
    expect(roles.map((r) => r.name).sort()).toEqual([
      'company_admin',
      'company_staff',
      'non_teaching',
      'student',
      'system_admin',
      'teaching',
    ]);

    await expect(
      tenantDb.runInTenantContext(ctxFor(company.id, 'company_admin'), (tx) => tx.role.create({ data: { name: 'rogue_role' } })),
    ).rejects.toThrow(); // app_user has no INSERT grant on roles at all — only a superuser-owned writer may write to it
  });
});

describe('Global role-name uniqueness (roles_name_unique)', () => {
  it('rejects a second role with the same name (the migration already seeded the full role catalog)', async () => {
    await expect(superPrisma.role.create({ data: { name: 'company_staff' } })).rejects.toThrow();
  });
});

describe('Case-insensitive per-company username uniqueness (users_company_username_unique)', () => {
  it('rejects a case-variant duplicate username within the SAME company', async () => {
    const company = await tenantDb.runInTenantContext(systemAdminCtx, (tx) =>
      tx.company.create({ data: { name: 'Username Case Co', contactPerson: 'U', mobile: '9999999991', email: 'u@x.com', address: 'X' } }),
    );
    const role = await tenantDb.runInTenantContext(systemAdminCtx, (tx) =>
      tx.role.findFirstOrThrow({ where: { name: 'company_admin' } }),
    );
    await tenantDb.runInTenantContext(systemAdminCtx, (tx) =>
      tx.user.create({
        data: { companyId: company.id, roleId: role.id, name: 'A', username: 'JohnDoe', passwordHash: 'x', email: 'a@u.com' },
      }),
    );
    await expect(
      tenantDb.runInTenantContext(systemAdminCtx, (tx) =>
        tx.user.create({
          data: { companyId: company.id, roleId: role.id, name: 'B', username: 'johndoe', passwordHash: 'x', email: 'b@u.com' },
        }),
      ),
    ).rejects.toThrow();
  });
});

describe('refresh_tokens RLS (specs/002 data-model.md, tasks.md T024)', () => {
  async function seedUserWithToken() {
    const company = await tenantDb.runInTenantContext(systemAdminCtx, (tx) =>
      tx.company.create({ data: { name: 'Token Co', contactPerson: 'P', mobile: '9700000001', email: 'p@x.com', address: 'X' } }),
    );
    const role = await tenantDb.runInTenantContext(systemAdminCtx, (tx) =>
      tx.role.findFirstOrThrow({ where: { name: 'student' } }),
    );
    const user = await tenantDb.runInTenantContext(systemAdminCtx, (tx) =>
      tx.user.create({
        data: { companyId: company.id, roleId: role.id, name: 'S', username: '9700000099', passwordHash: 'x', email: 's@x.com' },
      }),
    );
    const token = await tenantDb.runInTenantContext({ userId: user.id, role: 'student', companyId: company.id }, (tx) =>
      tx.refreshToken.create({
        data: { userId: user.id, tokenHash: 'hash-a', expiresAt: new Date(Date.now() + 86400000) },
      }),
    );
    return { company, user, token };
  }

  it("a user can see their own refresh token but not another user's", async () => {
    const { company, user, token } = await seedUserWithToken();
    const otherRole = await tenantDb.runInTenantContext(systemAdminCtx, (tx) =>
      tx.role.findFirstOrThrow({ where: { name: 'student' } }),
    );
    const otherUser = await tenantDb.runInTenantContext(systemAdminCtx, (tx) =>
      tx.user.create({
        data: { companyId: company.id, roleId: otherRole.id, name: 'O', username: '9700000098', passwordHash: 'x', email: 'o@x.com' },
      }),
    );

    const ownVisible = await tenantDb.runInTenantContext({ userId: user.id, role: 'student', companyId: company.id }, (tx) =>
      tx.refreshToken.findMany(),
    );
    expect(ownVisible.map((t) => t.id)).toEqual([token.id]);

    const otherVisible = await tenantDb.runInTenantContext({ userId: otherUser.id, role: 'student', companyId: company.id }, (tx) =>
      tx.refreshToken.findMany(),
    );
    expect(otherVisible).toHaveLength(0);
  });

  it('system_admin sees every refresh token (platform-wide bypass)', async () => {
    await seedUserWithToken();
    const all = await tenantDb.runInTenantContext(systemAdminCtx, (tx) => tx.refreshToken.findMany());
    expect(all.length).toBeGreaterThanOrEqual(1);
  });

  it('the pre-authentication auth_service system-actor context can look up a token by hash with no user_id set', async () => {
    const { token } = await seedUserWithToken();
    const found = await tenantDb.runInTenantContext({ role: 'system_actor', systemActor: 'auth_service' }, (tx) =>
      tx.refreshToken.findUnique({ where: { tokenHash: 'hash-a' } }),
    );
    expect(found?.id).toBe(token.id);
  });

  it('a user cannot revoke (UPDATE) another user\'s refresh token', async () => {
    const { company, token } = await seedUserWithToken();
    const otherRole = await tenantDb.runInTenantContext(systemAdminCtx, (tx) =>
      tx.role.findFirstOrThrow({ where: { name: 'student' } }),
    );
    const otherUser = await tenantDb.runInTenantContext(systemAdminCtx, (tx) =>
      tx.user.create({
        data: { companyId: company.id, roleId: otherRole.id, name: 'O2', username: '9700000097', passwordHash: 'x', email: 'o2@x.com' },
      }),
    );
    const updated = await tenantDb.runInTenantContext({ userId: otherUser.id, role: 'student', companyId: company.id }, (tx) =>
      tx.refreshToken.updateMany({ where: { id: token.id }, data: { revokedAt: new Date() } }),
    );
    expect(updated.count).toBe(0); // RLS silently filters the row out of the UPDATE's own WHERE, not an error
  });
});

describe('auth_audit_logs RLS (specs/002 data-model.md, tasks.md T024)', () => {
  async function seedCompanyWithAuditLog() {
    const company = await tenantDb.runInTenantContext(systemAdminCtx, (tx) =>
      tx.company.create({ data: { name: 'Audit Co', contactPerson: 'P', mobile: '9800000001', email: 'p@x.com', address: 'X' } }),
    );
    await tenantDb.runInTenantContext({ role: 'system_actor', systemActor: 'auth_service' }, (tx) =>
      tx.authAuditLog.create({ data: { companyId: company.id, eventType: 'login_success' } }),
    );
    return company;
  }

  it('only the auth_service system-actor identity can INSERT into auth_audit_logs', async () => {
    const company = await seedCompanyWithAuditLog();
    await expect(
      tenantDb.runInTenantContext({ role: 'company_admin', companyId: company.id }, (tx) =>
        tx.authAuditLog.create({ data: { companyId: company.id, eventType: 'login_success' } }),
      ),
    ).rejects.toThrow();
  });

  it("a company_admin can read their own company's audit log rows but not another company's", async () => {
    const companyA = await seedCompanyWithAuditLog();
    const companyB = await seedCompanyWithAuditLog();

    const asA = await tenantDb.runInTenantContext({ role: 'company_admin', companyId: companyA.id }, (tx) =>
      tx.authAuditLog.findMany(),
    );
    expect(asA).toHaveLength(1);
    expect(asA[0].companyId).toBe(companyA.id);

    const asB = await tenantDb.runInTenantContext({ role: 'company_admin', companyId: companyB.id }, (tx) =>
      tx.authAuditLog.findMany(),
    );
    expect(asB).toHaveLength(1);
    expect(asB[0].companyId).toBe(companyB.id);
  });

  it('system_admin can read every company\'s audit log rows (platform-wide bypass)', async () => {
    await seedCompanyWithAuditLog();
    await seedCompanyWithAuditLog();
    const all = await tenantDb.runInTenantContext(systemAdminCtx, (tx) => tx.authAuditLog.findMany());
    expect(all.length).toBeGreaterThanOrEqual(2);
  });

  it('a student cannot read any auth_audit_logs row at all (no predicate grants that role SELECT)', async () => {
    const company = await seedCompanyWithAuditLog();
    const asStudent = await tenantDb.runInTenantContext({ role: 'student', companyId: company.id }, (tx) =>
      tx.authAuditLog.findMany(),
    );
    expect(asStudent).toHaveLength(0);
  });
});
