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
  await superPrisma.$executeRawUnsafe('TRUNCATE TABLE users, categories, departments, roles, companies CASCADE');
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

  it('auto-seeds company_admin/staff/student roles on company creation (trigger)', async () => {
    const company = await tenantDb.runInTenantContext(systemAdminCtx, (tx) =>
      tx.company.create({
        data: { name: 'Trigger Canteen', contactPerson: 'Bob', mobile: '9000000002', email: 'b@test.com', address: 'Campus' },
      }),
    );
    const seededRoles = await tenantDb.runInTenantContext(systemAdminCtx, (tx) =>
      tx.role.findMany({ where: { companyId: company.id }, orderBy: { name: 'asc' } }),
    );
    expect(seededRoles.map((r) => r.name)).toEqual(['company_admin', 'staff', 'student']);
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
      tx.role.findFirstOrThrow({ where: { companyId: company.id, name: 'company_admin' } }),
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
      tx.role.findFirstOrThrow({ where: { companyId: companyB.id, name: 'company_admin' } }),
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

  it('lets a company_admin read their own company\'s role list (to assign roles) but never write to it', async () => {
    const { company } = await seedCompanyWithAdminRole();
    const roles = await tenantDb.runInTenantContext(ctxFor(company.id, 'company_admin'), (tx) => tx.role.findMany());
    expect(roles.map((r) => r.name).sort()).toEqual(['company_admin', 'staff', 'student']);

    await expect(
      tenantDb.runInTenantContext(ctxFor(company.id, 'company_admin'), (tx) =>
        tx.role.create({ data: { name: 'rogue_role', companyId: company.id } }),
      ),
    ).rejects.toThrow(); // app_user has no INSERT grant on roles at all — only the SECURITY DEFINER trigger writes to it
  });
});

describe('Global system_admin role uniqueness (roles_global_system_admin_unique)', () => {
  it('CHECK constraint rejects a company-less role that is not system_admin', async () => {
    await expect(
      superPrisma.role.create({ data: { name: 'orphan_role', companyId: null } }),
    ).rejects.toThrow();
  });

  it('unique index rejects a SECOND global system_admin role (distinct from the CHECK constraint)', async () => {
    // Unique indexes are enforced regardless of role (superuser or not) — only
    // RLS is bypassed by a superuser, not table constraints/indexes. app_user
    // has no INSERT grant on `roles` at all (only the SECURITY DEFINER
    // trigger writes to it), so this must go through superPrisma directly.
    await superPrisma.role.create({ data: { name: 'system_admin', companyId: null } });
    await expect(
      superPrisma.role.create({ data: { name: 'system_admin', companyId: null } }),
    ).rejects.toThrow();
  });
});

describe('Per-company role-name uniqueness (roles_company_name_unique)', () => {
  it('rejects a second role with the same name in the same company (the trigger already seeded company_admin/staff/student)', async () => {
    const company = await tenantDb.runInTenantContext(systemAdminCtx, (tx) =>
      tx.company.create({ data: { name: 'Role Uniqueness Co', contactPerson: 'R', mobile: '9888888881', email: 'r@x.com', address: 'X' } }),
    );
    // The trigger already seeded a 'staff' role for this company; inserting
    // a second one with the same name must violate roles_company_name_unique.
    await expect(
      superPrisma.role.create({ data: { name: 'staff', companyId: company.id } }),
    ).rejects.toThrow();
  });

  it('allows the SAME role name at two different companies (per-company, not global)', async () => {
    const [companyA, companyB] = await Promise.all([
      tenantDb.runInTenantContext(systemAdminCtx, (tx) =>
        tx.company.create({ data: { name: 'Role Co A', contactPerson: 'A', mobile: '9888888882', email: 'ra@x.com', address: 'X' } }),
      ),
      tenantDb.runInTenantContext(systemAdminCtx, (tx) =>
        tx.company.create({ data: { name: 'Role Co B', contactPerson: 'B', mobile: '9888888883', email: 'rb@x.com', address: 'X' } }),
      ),
    ]);
    // Both companies already have their own 'staff' role seeded by the
    // trigger with no conflict — proving the constraint is per-company.
    const staffA = await tenantDb.runInTenantContext(systemAdminCtx, (tx) =>
      tx.role.findFirstOrThrow({ where: { companyId: companyA.id, name: 'staff' } }),
    );
    const staffB = await tenantDb.runInTenantContext(systemAdminCtx, (tx) =>
      tx.role.findFirstOrThrow({ where: { companyId: companyB.id, name: 'staff' } }),
    );
    expect(staffA.name).toBe(staffB.name);
    expect(staffA.id).not.toBe(staffB.id);
  });
});

describe('Case-insensitive per-company username uniqueness (users_company_username_unique)', () => {
  it('rejects a case-variant duplicate username within the SAME company', async () => {
    const company = await tenantDb.runInTenantContext(systemAdminCtx, (tx) =>
      tx.company.create({ data: { name: 'Username Case Co', contactPerson: 'U', mobile: '9999999991', email: 'u@x.com', address: 'X' } }),
    );
    const role = await tenantDb.runInTenantContext(systemAdminCtx, (tx) =>
      tx.role.findFirstOrThrow({ where: { companyId: company.id, name: 'company_admin' } }),
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
