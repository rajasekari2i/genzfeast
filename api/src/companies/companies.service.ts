import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContext, TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { PasswordService } from '../auth/password.service';
import { generateProvisioningPassword } from './generated-password';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CreateCompanyAdminDto } from './dto/create-company-admin.dto';
import { CompanyResponse, UserResponse, toCompanyResponse, toUserResponse } from './companies.mapper';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly passwords: PasswordService,
  ) {}

  async list(ctx: TenantContext): Promise<CompanyResponse[]> {
    const companies = await this.tenantPrisma.runInTenantContext(ctx, (tx) =>
      tx.company.findMany({
        where: { isDeleted: false },
        orderBy: { createdAt: 'desc' },
      }),
    );
    return companies.map(toCompanyResponse);
  }

  /**
   * Creates the Company AND its first Company Admin, in one transaction.
   *
   * Onboarding used to be two calls (this, then POST /:companyId/admins), and
   * a Company created without the second call had no way for anyone to log
   * into it. Doing both here means a tenant is never left unreachable: if the
   * admin insert fails, the company insert rolls back with it.
   *
   * The admin is derived from the company's own contact details —
   * `contact_person` becomes the name, `mobile` the username, `email` the
   * email — because those are exactly the person the System Admin just
   * recorded as responsible for the canteen.
   *
   * The password is GENERATED and returned once (FR-001a). It is never a
   * fixed default: a known credential baked into the codebase is safe only
   * for as long as nobody points it at production, which is the weakness
   * scripts/seed-system-admin-dev.ts warns about in its own header.
   */
  async create(ctx: TenantContext, dto: CreateCompanyDto): Promise<CompanyResponse> {
    const temporaryPassword = generateProvisioningPassword();
    const passwordHash = await this.passwords.hash(temporaryPassword);

    return this.tenantPrisma.runInTenantContext(ctx, async (tx) => {
      // Roles are global, not per-company (migration 20260907170000). Read it
      // BEFORE creating anything, so a corrupt role catalog fails the whole
      // request rather than leaving a company behind.
      const role = await tx.role.findFirst({ where: { name: 'company_admin' } });
      if (!role) {
        throw new NotFoundException('company_admin role not found');
      }

      const company = await tx.company.create({
        data: {
          name: dto.name,
          contactPerson: dto.contact_person,
          mobile: dto.mobile,
          email: dto.email,
          address: dto.address,
          createdBy: ctx.userId,
        },
      });

      // `username` is unique per TENANT, not globally (migration
      // 20260912205205), and this company has no other users yet — so the
      // mobile number cannot collide here, however many other canteens
      // already use it.
      const admin = await tx.user.create({
        data: {
          companyId: company.id,
          roleId: role.id,
          name: dto.contact_person,
          username: dto.mobile,
          passwordHash,
          email: dto.email,
          createdBy: ctx.userId,
        },
        select: { id: true, name: true, username: true, email: true },
      });

      return {
        ...toCompanyResponse(company),
        admin: { ...admin, temporary_password: temporaryPassword },
      };
    });
  }

  async update(ctx: TenantContext, companyId: string, dto: UpdateCompanyDto): Promise<CompanyResponse> {
    return this.tenantPrisma.runInTenantContext(ctx, async (tx) => {
      const existing = await tx.company.findFirst({ where: { id: companyId, isDeleted: false } });
      if (!existing) {
        throw new NotFoundException('Company not found');
      }
      const updated = await tx.company.update({
        where: { id: companyId },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.contact_person !== undefined && { contactPerson: dto.contact_person }),
          ...(dto.mobile !== undefined && { mobile: dto.mobile }),
          ...(dto.email !== undefined && { email: dto.email }),
          ...(dto.address !== undefined && { address: dto.address }),
          ...(dto.is_open !== undefined && { isOpen: dto.is_open }),
          ...(dto.is_sms !== undefined && { isSms: dto.is_sms }),
          // specs/015-contact-us-page FR-005 — System Admin only, via the
          // dedicated Contact Us management screen.
          ...(dto.operating_hours !== undefined && { operatingHours: dto.operating_hours }),
          updatedBy: ctx.userId,
        },
      });
      return toCompanyResponse(updated);
    });
  }

  /**
   * Soft delete only (CLAUDE.md's Data Conventions — never hard-delete a
   * Company, which is still referenced by its Users/Products/Orders). Also
   * revokes every active refresh token for every one of this Company's
   * users, in every role — otherwise a session already in progress would
   * keep working (via /auth/refresh) until it naturally expired, up to 14
   * days, rather than being cut off immediately. Mirrors
   * AuthService.revokeAllSessions's own "revoke on block" pattern for a
   * locked account; auth.service.ts's login check is what then rejects any
   * *new* login attempt against this Company with "blocked contact admin".
   * Runs under the caller's own system_admin ctx — refresh_tokens' RLS
   * policy already grants system_admin unrestricted access, so no separate
   * per-user session context is needed the way AuthService's own helper
   * requires.
   */
  async remove(ctx: TenantContext, companyId: string): Promise<void> {
    await this.tenantPrisma.runInTenantContext(ctx, async (tx) => {
      const existing = await tx.company.findFirst({ where: { id: companyId, isDeleted: false } });
      if (!existing) {
        throw new NotFoundException('Company not found');
      }

      await tx.company.update({
        where: { id: companyId },
        data: { isDeleted: true, updatedBy: ctx.userId },
      });

      const companyUsers = await tx.user.findMany({
        where: { companyId, isDeleted: false },
        select: { id: true },
      });
      if (companyUsers.length > 0) {
        await tx.refreshToken.updateMany({
          where: { userId: { in: companyUsers.map((u) => u.id) }, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    });
  }

  async createCompanyAdmin(
    ctx: TenantContext,
    companyId: string,
    dto: CreateCompanyAdminDto,
  ): Promise<UserResponse> {
    return this.tenantPrisma.runInTenantContext(ctx, async (tx) => {
      const company = await tx.company.findFirst({ where: { id: companyId, isDeleted: false } });
      if (!company) {
        throw new NotFoundException('Company not found');
      }
      // Roles are global, not per-company (migration 20260907170000) — the
      // company_admin role always exists platform-wide, so a missing row
      // here would indicate DB corruption, not a client error.
      const role = await tx.role.findFirst({ where: { name: 'company_admin' } });
      if (!role) {
        throw new NotFoundException('company_admin role not found');
      }

      // Through PasswordService, not argon2 directly: this call used to be
      // `argon2.hash(dto.password)`, which omits `{ type: argon2id }` and so
      // used the library default (argon2i). Verification still worked —
      // the hash self-describes — but it contradicted the documented
      // choice and the service's own claim to be the single hashing path.
      const passwordHash = await this.passwords.hash(dto.password);

      try {
        // select excludes passwordHash — coding_standard.md §4.4 ("always
        // select the fields a handler actually needs... avoids accidentally
        // leaking a column like password_hash"). toUserResponse never reads
        // it either way, but this removes it from the object entirely rather
        // than relying solely on the mapper to omit it.
        const user = await tx.user.create({
          data: {
            companyId,
            roleId: role.id,
            name: dto.name,
            username: dto.username,
            passwordHash,
            email: dto.email,
            createdBy: ctx.userId,
          },
          select: {
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
          },
        });
        return toUserResponse(user, role.name);
      } catch (error) {
        // Relies on the DB's own partial unique index (users_company_username_unique)
        // as the source of truth for the uniqueness rule, rather than a
        // separate pre-check that would race with a concurrent request.
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
}
