/**
 * DI token for the app's PrismaClient instance (bound to APP_DATABASE_URL —
 * the non-superuser app_user role, never the migration/superuser
 * connection). A Symbol, not a class, so it needs @Inject() at the
 * consuming constructor.
 */
export const APP_PRISMA_CLIENT = Symbol('APP_PRISMA_CLIENT');
