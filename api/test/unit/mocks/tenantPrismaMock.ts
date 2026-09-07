import type { TenantContext } from '../../../src/common/prisma/tenant-prisma.service';

/**
 * A minimal stand-in for TenantPrismaService, for genuine unit tests (see
 * jest.config.js's "unit" project) that must never touch a real database.
 * `runInTenantContext` just invokes the callback with whatever fake `tx`
 * the test provides — no transaction, no `SET LOCAL`, no Postgres
 * connection of any kind, ever. Each test file builds its own fake `tx`
 * shaped only for the Prisma calls the code under test actually makes
 * (see e.g. test/unit/token-rotation/rotation.spec.ts's in-memory
 * refresh-token fake) — this helper only wires that fake into the
 * `TenantPrismaService` interface shape a service under test expects.
 */
export function createMockTenantPrisma<Tx>(tx: Tx) {
  return {
    runInTenantContext: async <T>(_ctx: TenantContext, work: (tx: Tx) => Promise<T> | T): Promise<T> => work(tx),
    disconnect: async () => undefined,
  };
}
