import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

/**
 * Access-token claim shape, per specs/002-registration-login-jwt-auth's
 * contracts/openapi.yaml (Session.access_token description): sub (user id),
 * role, company_id (nullable for system_admin), iat, exp, jti.
 */
export interface JwtPayload {
  sub: string;
  role: string;
  company_id: string | null;
  iat: number;
  exp: number;
  jti: string;
}

export interface RequestWithUser extends Request {
  user: JwtPayload;
}

/**
 * Verifies the Bearer access token and attaches its claims to `request.user`.
 * specs/002 owns *issuing* these tokens (login/register/refresh) — this
 * guard only verifies a token already issued (by that feature, once built,
 * or by scripts/mint-dev-jwt.ts for local testing in the meantime), per
 * coding_standard.md §3 ("company_id/role/user id come only from the
 * verified JWT").
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const token = authHeader.slice('Bearer '.length);
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      (request as RequestWithUser).user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
