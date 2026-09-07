import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Argon2id hash/verify wrapper (specs/002-registration-login-jwt-auth
 * research.md §1) — the single code path every password hash in the system
 * goes through, reused as-is by 003's forgot-password reset, 007's
 * change-password, and 012's bootstrap seed script, per each of those
 * features' own plans.
 */
@Injectable()
export class PasswordService {
  hash(plaintext: string): Promise<string> {
    return argon2.hash(plaintext, { type: argon2.argon2id });
  }

  verify(hash: string, plaintext: string): Promise<boolean> {
    return argon2.verify(hash, plaintext);
  }
}
