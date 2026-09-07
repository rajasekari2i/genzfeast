import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { APP_PRISMA_CLIENT } from './prisma-client.token';
import { TenantPrismaService } from './tenant-prisma.service';

// coding_standard.md §3/§4.3: one PrismaModule, @Global(), exporting the
// tenant-aware wrapper — no other module may construct its own PrismaClient.
// The client is bound to APP_DATABASE_URL (the non-superuser app_user role)
// exclusively; the app never connects as the migration/superuser role.
@Global()
@Module({
  providers: [
    {
      provide: APP_PRISMA_CLIENT,
      useFactory: (config: ConfigService) =>
        new PrismaClient({ datasourceUrl: config.getOrThrow<string>('APP_DATABASE_URL') }),
      inject: [ConfigService],
    },
    TenantPrismaService,
  ],
  exports: [TenantPrismaService],
})
export class PrismaModule {}
