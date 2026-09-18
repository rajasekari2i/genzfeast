import { Controller, Get, Header, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ProductImageStoragePort } from './product-image-storage.port';

/**
 * Deliberately outside every guard/interceptor in this module — Railway
 * Buckets are private (no public bucket URL), so ProductImageStoragePort's
 * `upload()` points image_url at this route instead, which fetches the
 * object server-side and streams it back. Any authenticated OR unauthenticated
 * caller can hit this — a product photo has to be viewable by any Student
 * browsing the menu, with no auth token attached to an <Image> request,
 * the same requirement the previous Supabase Storage adapter's public
 * bucket satisfied directly.
 */
@Controller('products/image')
export class ProductImagesController {
  constructor(private readonly imageStorage: ProductImageStoragePort) {}

  @Get(':key')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  async getImage(@Param('key') key: string, @Res() res: Response): Promise<void> {
    const { stream, contentType } = await this.imageStorage.get(key);
    res.setHeader('Content-Type', contentType);
    stream.pipe(res);
  }
}
