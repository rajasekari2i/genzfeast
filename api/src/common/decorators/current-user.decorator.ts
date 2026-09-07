import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtPayload, RequestWithUser } from '../guards/jwt-auth.guard';

/** The verified JWT's raw claims (coding_standard.md §3) — for handlers that need the full payload, not just the derived TenantContext. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): JwtPayload => {
  const request = ctx.switchToHttp().getRequest<RequestWithUser>();
  return request.user;
});
