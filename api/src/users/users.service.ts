import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { TenantContext, TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { CreateTenantUserDto } from './dto/create-tenant-user.dto';
import { UpdateTenantUserDto } from './dto/update-tenant-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { UserResponse, toUserResponse } from '../companies/companies.mapper';

/**
 * The roles a Company Admin may create/edit/delete through /tenant/users
 * (this task's revised scope — company_admin itself was dropped from this
 * screen on explicit request; creating a peer admin isn't available here).
 * Deliberately a different set from ADMIN_MANAGEABLE_ROLES below — the two
 * screens' scopes diverged on this task's own explicit choice, so they can
 * no longer share one constant the way they used to.
 */
const TENANT_MANAGEABLE_ROLES = ['company_staff', 'student', 'teaching', 'non_teaching'];

/** The roles System Admin may create/edit through /admin/users — unchanged from before this task. */
const ADMIN_MANAGEABLE_ROLES = ['company_staff', 'company_admin'];

const SELECT_FIELDS = {
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
} as const;

/**
 * specs/001-company-role-user-setup FR-009/FR-010/FR-018/FR-019, plus the
 * role-change endpoint added for this task. Every method is scoped to
 * `ctx.companyId` (RolesGuard restricts every route here to company_admin,
 * which always carries a company_id claim — matching CategoriesService's
 * own reasoning).
 */
@Injectable()
export class UsersService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async list(ctx: TenantContext): Promise<UserResponse[]> {
    const users = await this.tenantPrisma.runInTenantContext(ctx, (tx) =>
      tx.user.findMany({
        where: {
          companyId: ctx.companyId as string,
          isDeleted: false,
          role: { name: { in: TENANT_MANAGEABLE_ROLES } },
        },
        include: { role: true },
        orderBy: { createdAt: 'desc' },
      }),
    );
    return users.map((u) => toUserResponse(u, u.role.name));
  }

  /**
   * `category_id` is required exactly when `dto.role === 'student'`
   * (CreateTenantUserDto's own `@ValidateIf`) — validated for real existence
   * within this Company here, mirroring AuthService.registerStudent's own
   * category/department validation exactly (same messages, same shape).
   */
  async create(ctx: TenantContext, dto: CreateTenantUserDto): Promise<UserResponse> {
    return this.tenantPrisma.runInTenantContext(ctx, async (tx) => {
      // Roles are global, not per-company (migration 20260907170000) — a
      // missing lookup here would indicate DB corruption, not a client
      // error, matching CompaniesService.createCompanyAdmin's own precedent.
      const role = await tx.role.findFirst({ where: { name: dto.role } });
      if (!role) {
        throw new NotFoundException(`${dto.role} role not found`);
      }

      if (dto.role === 'student') {
        const category = await tx.category.findFirst({
          where: { id: dto.category_id, companyId: ctx.companyId as string, isDeleted: false },
        });
        if (!category) {
          throw new NotFoundException('Invalid category for this company');
        }
      }
      if (dto.department_id) {
        const department = await tx.department.findFirst({
          where: { id: dto.department_id, companyId: ctx.companyId as string, isDeleted: false },
        });
        if (!department) {
          throw new NotFoundException('Invalid department for this company');
        }
      }

      const passwordHash = await argon2.hash(dto.password);

      try {
        const user = await tx.user.create({
          data: {
            companyId: ctx.companyId as string,
            roleId: role.id,
            name: dto.name,
            username: dto.username,
            passwordHash,
            email: dto.email,
            gender: dto.gender,
            categoryId: dto.role === 'student' ? dto.category_id : undefined,
            departmentId: dto.role === 'student' ? dto.department_id : undefined,
            createdBy: ctx.userId,
          },
          select: SELECT_FIELDS,
        });
        return toUserResponse(user, role.name);
      } catch (error) {
        // users_company_username_unique (FR-013/FR-014).
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
  }

  /** FR-010: activate/deactivate accounts this screen manages only — never a fellow Company Admin. */
  async updateStatus(ctx: TenantContext, userId: string, dto: UpdateUserStatusDto): Promise<UserResponse> {
    return this.tenantPrisma.runInTenantContext(ctx, async (tx) => {
      const existing = await tx.user.findFirst({
        where: { id: userId, companyId: ctx.companyId as string, isDeleted: false },
        include: { role: true },
      });
      if (!existing) {
        throw new NotFoundException('User not found');
      }
      if (!TENANT_MANAGEABLE_ROLES.includes(existing.role.name)) {
        throw new ForbiddenException('Only accounts manageable from this screen can be activated/deactivated here');
      }

      const updated = await tx.user.update({
        where: { id: userId },
        data: { status: dto.status, updatedBy: ctx.userId },
        select: SELECT_FIELDS,
      });
      return toUserResponse(updated, existing.role.name);
    });
  }

  /**
   * Not in the original contract — added per this task's explicit ask.
   * Reassigns only among TENANT_MANAGEABLE_ROLES (UpdateUserRoleDto's own
   * restriction); never touches a Company Admin or System Admin account.
   */
  async updateRole(ctx: TenantContext, userId: string, dto: UpdateUserRoleDto): Promise<UserResponse> {
    return this.tenantPrisma.runInTenantContext(ctx, async (tx) => {
      const existing = await tx.user.findFirst({
        where: { id: userId, companyId: ctx.companyId as string, isDeleted: false },
        include: { role: true },
      });
      if (!existing) {
        throw new NotFoundException('User not found');
      }
      if (!TENANT_MANAGEABLE_ROLES.includes(existing.role.name)) {
        throw new ForbiddenException('Only accounts manageable from this screen can have their role changed here');
      }

      const newRole = await tx.role.findFirst({ where: { name: dto.role } });
      if (!newRole) {
        throw new NotFoundException(`${dto.role} role not found`);
      }

      const updated = await tx.user.update({
        where: { id: userId },
        data: { roleId: newRole.id, updatedBy: ctx.userId },
        select: SELECT_FIELDS,
      });
      return toUserResponse(updated, newRole.name);
    });
  }

  /**
   * The tenant-scoped general edit this task's new company_admin Users
   * screen needs (mirrors System Admin's own `update` below, but scoped to
   * `ctx.companyId` and covering TENANT_MANAGEABLE_ROLES instead). PATCH
   * semantics — only submitted fields change; `password` omitted keeps the
   * existing one.
   */
  async updateTenant(ctx: TenantContext, userId: string, dto: UpdateTenantUserDto): Promise<UserResponse> {
    return this.tenantPrisma.runInTenantContext(ctx, async (tx) => {
      const existing = await tx.user.findFirst({
        where: { id: userId, companyId: ctx.companyId as string, isDeleted: false },
        include: { role: true },
      });
      if (!existing) {
        throw new NotFoundException('User not found');
      }
      if (!TENANT_MANAGEABLE_ROLES.includes(existing.role.name)) {
        throw new ForbiddenException('Only accounts manageable from this screen can be edited here');
      }

      let newRole = existing.role;
      if (dto.role !== undefined && dto.role !== existing.role.name) {
        const role = await tx.role.findFirst({ where: { name: dto.role } });
        if (!role) {
          throw new NotFoundException(`${dto.role} role not found`);
        }
        newRole = role;
      }

      if (dto.category_id !== undefined) {
        const category = await tx.category.findFirst({
          where: { id: dto.category_id, companyId: ctx.companyId as string, isDeleted: false },
        });
        if (!category) {
          throw new NotFoundException('Invalid category for this company');
        }
      }
      if (dto.department_id !== undefined) {
        const department = await tx.department.findFirst({
          where: { id: dto.department_id, companyId: ctx.companyId as string, isDeleted: false },
        });
        if (!department) {
          throw new NotFoundException('Invalid department for this company');
        }
      }

      const passwordHash = dto.password !== undefined ? await argon2.hash(dto.password) : undefined;

      try {
        const updated = await tx.user.update({
          where: { id: userId },
          data: {
            ...(dto.name !== undefined && { name: dto.name }),
            ...(dto.username !== undefined && { username: dto.username }),
            ...(passwordHash !== undefined && { passwordHash }),
            ...(dto.email !== undefined && { email: dto.email }),
            ...(dto.gender !== undefined && { gender: dto.gender }),
            ...(dto.category_id !== undefined && { categoryId: dto.category_id }),
            ...(dto.department_id !== undefined && { departmentId: dto.department_id }),
            ...(newRole.id !== existing.role.id && { roleId: newRole.id }),
            updatedBy: ctx.userId,
          },
          select: SELECT_FIELDS,
        });
        return toUserResponse(updated, newRole.name);
      } catch (error) {
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
  }

  /**
   * The tenant-scoped soft delete this task's new company_admin Users
   * screen needs (mirrors System Admin's own `remove` below, scoped to
   * `ctx.companyId`). Revokes every active refresh token for this user so
   * an in-progress session is cut off immediately; auth.service.ts's login
   * check then rejects any *new* login attempt with "blocked contact
   * admin".
   */
  async removeTenant(ctx: TenantContext, userId: string): Promise<void> {
    if (userId === ctx.userId) {
      throw new ForbiddenException('You cannot delete your own account');
    }

    await this.tenantPrisma.runInTenantContext(ctx, async (tx) => {
      const existing = await tx.user.findFirst({
        where: { id: userId, companyId: ctx.companyId as string, isDeleted: false },
        include: { role: true },
      });
      if (!existing) {
        throw new NotFoundException('User not found');
      }
      if (!TENANT_MANAGEABLE_ROLES.includes(existing.role.name)) {
        throw new ForbiddenException('Only accounts manageable from this screen can be deleted here');
      }

      await tx.user.update({ where: { id: userId }, data: { isDeleted: true, updatedBy: ctx.userId } });
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  /**
   * System Admin's cross-tenant equivalent of `list` — not scoped to any
   * one `company_id` (the caller's own JWT carries none), platform-wide
   * across every company. RolesGuard restricts the route this backs to
   * system_admin only, whose RLS bypass on `users` (users_tenant_isolation,
   * `FOR ALL`) already permits reading every row regardless of company_id.
   */
  async listAll(ctx: TenantContext): Promise<UserResponse[]> {
    const users = await this.tenantPrisma.runInTenantContext(ctx, (tx) =>
      tx.user.findMany({
        where: { isDeleted: false },
        include: { role: true },
        orderBy: { createdAt: 'desc' },
      }),
    );
    return users.map((u) => toUserResponse(u, u.role.name));
  }

  /**
   * System Admin's cross-tenant equivalent of `create` — takes an explicit
   * `company_id` from the request (there is no ctx.companyId to fall back
   * on) rather than the caller's own tenant. Restricted to the same two
   * roles Company Admin may already grant (CreateAdminUserDto's own note) —
   * creating a Student isn't supported here, matching this feature's scope.
   */
  async createForCompany(ctx: TenantContext, dto: CreateAdminUserDto): Promise<UserResponse> {
    return this.tenantPrisma.runInTenantContext(ctx, async (tx) => {
      const company = await tx.company.findFirst({ where: { id: dto.company_id, isDeleted: false } });
      if (!company) {
        throw new NotFoundException('Company not found');
      }

      const role = await tx.role.findFirst({ where: { name: dto.role } });
      if (!role) {
        throw new NotFoundException(`${dto.role} role not found`);
      }

      const passwordHash = await argon2.hash(dto.password);

      try {
        const user = await tx.user.create({
          data: {
            companyId: dto.company_id,
            roleId: role.id,
            name: dto.name,
            username: dto.username,
            passwordHash,
            email: dto.email,
            gender: dto.gender,
            createdBy: ctx.userId,
          },
          select: SELECT_FIELDS,
        });
        return toUserResponse(user, role.name);
      } catch (error) {
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
  }

  /**
   * System Admin's cross-tenant edit — PATCH semantics (coding_standard.md
   * §6), only submitted fields change. Restricted to ADMIN_MANAGEABLE_ROLES
   * (a Student or a fellow System Admin account is out of scope here,
   * matching this feature's own boundary) — both the existing row's role
   * AND a submitted new `role` must be one of them. `password` omitted
   * means "keep the existing one".
   */
  async update(ctx: TenantContext, userId: string, dto: UpdateAdminUserDto): Promise<UserResponse> {
    return this.tenantPrisma.runInTenantContext(ctx, async (tx) => {
      const existing = await tx.user.findFirst({
        where: { id: userId, isDeleted: false },
        include: { role: true },
      });
      if (!existing) {
        throw new NotFoundException('User not found');
      }
      if (!ADMIN_MANAGEABLE_ROLES.includes(existing.role.name)) {
        throw new ForbiddenException('Only Staff/Company Admin accounts can be edited here');
      }

      let newRole = existing.role;
      if (dto.role !== undefined && dto.role !== existing.role.name) {
        const role = await tx.role.findFirst({ where: { name: dto.role } });
        if (!role) {
          throw new NotFoundException(`${dto.role} role not found`);
        }
        newRole = role;
      }

      if (dto.company_id !== undefined) {
        const company = await tx.company.findFirst({ where: { id: dto.company_id, isDeleted: false } });
        if (!company) {
          throw new NotFoundException('Company not found');
        }
      }

      const passwordHash = dto.password !== undefined ? await argon2.hash(dto.password) : undefined;

      try {
        const updated = await tx.user.update({
          where: { id: userId },
          data: {
            ...(dto.name !== undefined && { name: dto.name }),
            ...(dto.username !== undefined && { username: dto.username }),
            ...(passwordHash !== undefined && { passwordHash }),
            ...(dto.email !== undefined && { email: dto.email }),
            ...(dto.gender !== undefined && { gender: dto.gender }),
            ...(dto.company_id !== undefined && { companyId: dto.company_id }),
            ...(newRole.id !== existing.role.id && { roleId: newRole.id }),
            updatedBy: ctx.userId,
          },
          select: SELECT_FIELDS,
        });
        return toUserResponse(updated, newRole.name);
      } catch (error) {
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
  }

  /**
   * System Admin's cross-tenant delete — any user, any role, any company.
   * Soft delete only (CLAUDE.md's Data Conventions), and revokes every
   * active refresh token for this user so an in-progress session is cut off
   * immediately rather than continuing to work via /auth/refresh until it
   * naturally expires. auth.service.ts's login check is what then rejects
   * any *new* login attempt for this account with "blocked contact admin".
   */
  async remove(ctx: TenantContext, userId: string): Promise<void> {
    if (userId === ctx.userId) {
      throw new ForbiddenException('You cannot delete your own account');
    }

    await this.tenantPrisma.runInTenantContext(ctx, async (tx) => {
      const existing = await tx.user.findFirst({ where: { id: userId, isDeleted: false } });
      if (!existing) {
        throw new NotFoundException('User not found');
      }

      await tx.user.update({ where: { id: userId }, data: { isDeleted: true, updatedBy: ctx.userId } });
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }
}
