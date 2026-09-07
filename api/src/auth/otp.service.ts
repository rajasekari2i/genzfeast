import { randomInt, createHash } from 'crypto';
import { Injectable } from '@nestjs/common';

// Excludes visually ambiguous characters (0/O, 1/I/l) — the code is
// hand-typed by a user off a push notification or the in-app fallback
// display (specs/003-forgot-password-otp-reset research.md §1-§2).
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

/**
 * Pure crypto — no DB access, mirroring 002's TokenService precedent
 * (specs/003-forgot-password-otp-reset research.md §1-§2). The code is
 * hashed before storage the same way 002 hashes refresh tokens.
 */
@Injectable()
export class OtpService {
  generateCode(): string {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    }
    return code;
  }

  hashCode(code: string): string {
    return createHash('sha256').update(code.toUpperCase()).digest('hex');
  }
}
