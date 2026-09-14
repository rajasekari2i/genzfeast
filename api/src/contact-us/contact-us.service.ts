import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantContext, TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { ContactUsResponse, toContactUsResponse } from './contact-us.mapper';

@Injectable()
export class ContactUsService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  /**
   * specs/015-contact-us-page FR-001/FR-002 — the caller's own company only,
   * from `ctx.companyId` (verified JWT claim). RLS's new
   * `companies_tenant_self_read` policy (data-model.md §2) independently
   * re-checks the same scoping — a bug here alone could never leak another
   * company's contact info.
   */
  async getContactUs(ctx: TenantContext): Promise<ContactUsResponse> {
    return this.tenantPrisma.runInTenantContext(ctx, async (tx) => {
      const company = await tx.company.findFirst({
        where: { id: ctx.companyId ?? undefined, isDeleted: false },
        select: { name: true, contactPerson: true, mobile: true, email: true, address: true, operatingHours: true },
      });
      if (!company) {
        throw new NotFoundException('Company not found');
      }
      return toContactUsResponse(company);
    });
  }
}
