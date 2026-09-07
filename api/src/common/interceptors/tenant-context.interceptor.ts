import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { RequestWithUser } from '../guards/jwt-auth.guard';
import type { TenantContext } from '../prisma/tenant-prisma.service';

export interface RequestWithTenantContext extends RequestWithUser {
  tenantContext: TenantContext;
}

/**
 * Populates `request.tenantContext` from the already-verified JWT
 * (coding_standard.md §4.3) — the single place that translates a JWT's
 * claims into the shape TenantPrismaService.runInTenantContext expects, so
 * no controller/service builds that object by hand from a raw claim.
 * Must run after JwtAuthGuard (which sets `request.user`).
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithTenantContext>();
    request.tenantContext = {
      userId: request.user.sub,
      role: request.user.role,
      companyId: request.user.company_id,
    };
    return next.handle();
  }
}
