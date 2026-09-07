import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductImageStoragePort, SupabaseProductImageStorageAdapter } from './product-image-storage.port';

@Module({
  controllers: [ProductsController],
  providers: [
    ProductsService,
    // specs/004 research.md §1 — swap for a different adapter only if the
    // storage provider itself ever changes; Supabase Storage is
    // Architecture's own decision, not a placeholder like 003's
    // NotificationPort.
    { provide: ProductImageStoragePort, useClass: SupabaseProductImageStorageAdapter },
  ],
})
export class ProductsModule {}
