import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductImagesController } from './product-images.controller';
import { ProductsService } from './products.service';
import { ProductImageStoragePort, RailwayBucketProductImageStorageAdapter } from './product-image-storage.port';

@Module({
  controllers: [ProductsController, ProductImagesController],
  providers: [
    ProductsService,
    { provide: ProductImageStoragePort, useClass: RailwayBucketProductImageStorageAdapter },
  ],
})
export class ProductsModule {}
