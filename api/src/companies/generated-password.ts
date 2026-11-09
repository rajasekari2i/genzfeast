import { randomInt } from 'crypto';

/**
 * Alphabet for a provisioning password that a human will be read over the
 * phone or copied from a screen once.
 *
 * Deliberately excludes the pairs that are indistinguishable in most UI
 * fonts — 0/O, 1/l/I — for the same reason specs/003's reset OTP does. A
 * provisioning credential that cannot be transcribed reliably generates a
 * support call, not security.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

/**
 * A single-use password for an auto-provisioned Company Admin.
 *
 * Uses `crypto.randomInt` rather than `Math.random`: this value is a real
 * credential from the moment it is created, and Math.random is not a CSPRNG.
 * `randomInt` is also rejection-sampled internally, so there is no modulo
 * bias across the alphabet.
 *
 * 14 characters from a 55-symbol alphabet is ~81 bits of entropy, which is
 * far beyond what the 8-character minimum requires — the cost of a longer
 * string is nothing here, since nobody types it twice.
 */
export function generateProvisioningPassword(length = 14): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[randomInt(ALPHABET.length)];
  }
  return out;
}
