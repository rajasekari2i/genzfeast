import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestWithTenantContext } from '../interceptors/tenant-context.interceptor';
import type { TenantContext } from '../prisma/tenant-prisma.service';

/** The TenantContext TenantContextInterceptor derived from the verified JWT — pass directly to TenantPrismaService.runInTenantContext. */
export const CurrentTenantContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext => {
    const request = ctx.switchToHttp().getRequest<RequestWithTenantContext>();
    return request.tenantContext;
  },
);
