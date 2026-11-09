// ============================================================================
// DEV ONLY — recovers a 6-digit OTP from its stored otp_hash.
//
// DO NOT ship, deploy, or run this anywhere near production. Its whole purpose
// is to defeat the OTP hash, which is only possible because the hash is
// unsalted SHA-256 over a 6-digit space (one million candidates, instant).
// Keep it for local testing of the pickup / mobile-verification flows.
//
// It is NOT "decryption": SHA-256 is one-way. This hashes all 1,000,000
// six-digit codes and matches the digest.
//
// Usage:  node scripts/crack-otp.js <otp_hash>
// ============================================================================
if (process.env.NODE_ENV === 'production') {
  console.error('crack-otp refuses to run with NODE_ENV=production.');
  process.exit(1);
}

const { createHash } = require('crypto');
const target = (process.argv[2] || '').trim().toLowerCase();
if (!/^[0-9a-f]{64}$/.test(target)) {
  console.error('Usage: node scripts/crack-otp.js <64-char-sha256-hex>');
  process.exit(1);
}

// Mirrors OtpService.hash — sha256(code.toUpperCase()). For digits the
// upper-casing is a no-op, but it keeps the two in lockstep if the alphabet
// ever changes.
const h = (s) => createHash('sha256').update(s.toUpperCase()).digest('hex');

for (let i = 0; i < 1_000_000; i++) {
  const code = String(i).padStart(6, '0');
  if (h(code) === target) {
    console.log(code);
    process.exit(0);
  }
}
console.error('No 6-digit numeric match (an alphanumeric reset code needs a 32^6 search).');
process.exit(2);
