/**
 * Setup for the "unit" Jest project only (jest.config.js) — makes real
 * database access structurally impossible for anything under test/unit/,
 * not just discouraged by convention. `.env` is never loaded for this
 * project (no dotenv/config here), and on top of that, constructing a real
 * PrismaClient throws immediately: even a future unit test that
 * accidentally imports `@prisma/client` directly, or a stray DATABASE_URL
 * left set in the shell's own environment, fails loudly at construction
 * time instead of silently reaching a real database.
 *
 * Unit tests must mock the one seam every service actually depends on —
 * TenantPrismaService — via test/unit/mocks/tenantPrismaMock.ts (or an
 * equivalent hand-built fake), never a real PrismaClient.
 */
jest.mock('@prisma/client', () => ({
  PrismaClient: class BlockedPrismaClient {
    constructor() {
      throw new Error(
        'PrismaClient must never be constructed in a unit test (test/unit/**) — mock TenantPrismaService instead ' +
          '(see test/unit/mocks/tenantPrismaMock.ts). Real-database tests belong in test/contract/ or test/rls/, ' +
          "run via `npm run test:integration`, never `npm run test:unit`.",
      );
    }
  },
}));
