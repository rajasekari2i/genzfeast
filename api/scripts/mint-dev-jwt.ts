/**
 * DEV-ONLY. Mints a short-lived access token for manual API testing
 * (Postman/curl) before specs/002-registration-login-jwt-auth (login/JWT
 * issuance) exists. This is a standalone CLI script only — it is never
 * imported by, or reachable from, the running application (src/**). Do not
 * reuse this pattern anywhere inside the app itself.
 *
 * Usage (JWT_SECRET must match the value in your .env):
 *   JWT_SECRET=<same as .env> npx ts-node scripts/mint-dev-jwt.ts --role system_admin
 *   JWT_SECRET=<same as .env> npx ts-node scripts/mint-dev-jwt.ts --role company_admin --company-id <uuid> --sub <uuid>
 *
 * Console output is deliberate here (this is a CLI tool's stdout, not
 * application logging — coding_standard.md §8 governs src/**, not scripts/).
 */
import { randomUUID } from 'crypto';
import { JwtService } from '@nestjs/jwt';

interface Args {
  role: string;
  sub: string;
  companyId: string | null;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index === -1 ? undefined : argv[index + 1];
  };
  return {
    role: get('--role') ?? 'system_admin',
    sub: get('--sub') ?? randomUUID(),
    companyId: get('--company-id') ?? null,
  };
}

function main(): void {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('Set JWT_SECRET (same value as your .env) before running this script.');
    process.exit(1);
  }

  const { role, sub, companyId } = parseArgs(process.argv.slice(2));
  const jwtService = new JwtService({ secret });
  const token = jwtService.sign(
    { sub, role, company_id: companyId },
    { expiresIn: '12h', jwtid: randomUUID() },
  );

  console.log(token);
  console.error(`\n(claims: sub=${sub} role=${role} company_id=${companyId ?? 'null'}, expires in 12h)`);
}

main();
