import { randomBytes, randomUUID, createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from '../common/guards/jwt-auth.guard';

export interface AccessTokenClaims {
  sub: string;
  role: string;
  companyId: string | null;
}

export interface SignedAccessToken {
  token: string;
  expiresIn: number;
}

export interface GeneratedRefreshToken {
  /** The raw, high-entropy opaque token — returned to the client exactly once, never persisted (research.md §3). */
  raw: string;
  /** SHA-256 hex digest of `raw` — the only form ever stored. */
  hash: string;
}

/**
 * Pure crypto — no DB access (specs/002-registration-login-jwt-auth tasks.md
 * T005). Access tokens are short-lived, stateless JWTs (research.md §2);
 * refresh tokens are opaque CSPRNG strings, hashed before storage
 * (research.md §3) — never a second JWT, so no claim inside it can go stale
 * across its multi-week lifetime.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async signAccessToken(claims: AccessTokenClaims): Promise<SignedAccessToken> {
    const expiresIn = this.configService.getOrThrow<number>('JWT_ACCESS_TOKEN_TTL_SECONDS');
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: claims.sub,
      role: claims.role,
      company_id: claims.companyId,
      jti: randomUUID(),
    };
    const token = await this.jwtService.signAsync(payload, { expiresIn });
    return { token, expiresIn };
  }

  generateRefreshToken(): GeneratedRefreshToken {
    const raw = randomBytes(32).toString('hex');
    return { raw, hash: this.hashRefreshToken(raw) };
  }

  hashRefreshToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  refreshTokenTtlMs(): number {
    const days = this.configService.getOrThrow<number>('JWT_REFRESH_TOKEN_TTL_DAYS');
    return days * 24 * 60 * 60 * 1000;
  }
}
