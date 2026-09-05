import { PrismaClient, Prisma } from '@prisma/client';

/**
 * The session context an RLS policy is predicated on (coding_standard.md §4.3).
 * `userId`/`companyId` come from a verified JWT for a real request;
 * `systemActor` is used instead by non-request code paths (the payment
 * webhook, seed scripts — see specs/011, specs/012) that have no
 * authenticated user at all.
 */
export interface TenantContext {
  userId?: string;
  role: string;
  companyId?: string | null;
  systemActor?: string;
}

/**
 * The ONLY sanctioned way any service touches the database
 * (coding_standard.md §4.3, §12 checklist). Every operation runs inside a
 * Prisma interactive transaction whose first statement sets the Postgres
 * session variables the RLS policies in
 * prisma/migrations/*_init_company_role_category_department_user/migration.sql
 * are predicated on — set_config's third argument (`true`) makes each value
 * transaction-local (SET LOCAL semantics), so it can never leak across
 * pooled connections or into a different request's transaction.
 *
 * No service may inject PrismaClient directly.
 */
export class TenantPrismaService {
  constructor(private readonly prisma: PrismaClient) {}

  async runInTenantContext<T>(
    ctx: TenantContext,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT
          set_config('app.current_user_id', ${ctx.userId ?? ''}, true),
          set_config('app.current_role', ${ctx.role}, true),
          set_config('app.current_company_id', ${ctx.companyId ?? ''}, true),
          set_config('app.current_system_actor', ${ctx.systemActor ?? ''}, true);
      `;
      return work(tx);
    });
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
