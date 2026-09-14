import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { CurrentTenantContext } from '../common/decorators/current-tenant-context.decorator';
import type { TenantContext } from '../common/prisma/tenant-prisma.service';
import { ContactUsService } from './contact-us.service';
import type { ContactUsResponse } from './contact-us.mapper';

/**
 * specs/015-contact-us-page contracts/openapi.yaml — GET /me/contact-us.
 * An explicit @Roles(...) allowlist (unlike profile/'s open-to-every-role
 * shape, research.md §5) — system_admin is not a viewer of this endpoint and
 * has no company_id to scope the query by in the first place.
 */
@Controller('me')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor)
export class ContactUsController {
  constructor(private readonly contactUsService: ContactUsService) {}

  @Get('contact-us')
  @Roles('company_admin', 'company_staff', 'student', 'teaching', 'non_teaching')
  getContactUs(@CurrentTenantContext() ctx: TenantContext): Promise<ContactUsResponse> {
    return this.contactUsService.getContactUs(ctx);
  }
}
