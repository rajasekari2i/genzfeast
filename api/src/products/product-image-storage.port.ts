import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';

export interface UploadImageInput {
  companyId: string;
  productId: string;
  buffer: Buffer;
  mimeType: string;
  originalName: string;
}

export interface StoredImage {
  stream: Readable;
  contentType: string;
}

/**
 * Seam between ProductsService and whatever actually stores the photo —
 * mirrors the NotificationPort pattern from specs/003. ProductsService
 * depends on this interface, not a concrete storage client, so a
 * not-yet-configured environment fails clearly at upload time rather than
 * blocking the whole app from booting.
 */
export abstract class ProductImageStoragePort {
  abstract upload(input: UploadImageInput): Promise<string>;
  /** Reads back an object previously stored by `upload`, keyed by the object key embedded in its returned URL. */
  abstract get(key: string): Promise<StoredImage>;
}

/**
 * Railway Bucket (S3-compatible) adapter. Railway Buckets are private —
 * there is no public-URL/public-ACL concept the way Supabase Storage had
 * (its predecessor here), so `upload()` does NOT return a direct bucket URL.
 * Instead it returns a URL pointing back at this API's own
 * `GET /products/image/:key` route (ProductImagesController, deliberately
 * outside any @UseGuards — a product photo has to be viewable by any
 * Student browsing the menu, with no auth token attached to an <Image>
 * request), which fetches the object from the bucket server-side using
 * this same adapter's `get()` and streams it back. This trades a direct
 * CDN/object-store hit for a round-trip through the API on every image
 * view — the accepted cost of Railway Buckets having no public-URL mode.
 */
@Injectable()
export class RailwayBucketProductImageStorageAdapter extends ProductImageStoragePort {
  private readonly logger = new Logger(RailwayBucketProductImageStorageAdapter.name);
  private client: S3Client | null = null;

  constructor(private readonly configService: ConfigService) {
    super();
  }

  private getClient(): S3Client {
    if (this.client) {
      return this.client;
    }
    const endpoint = this.configService.get<string>('RAILWAY_BUCKET_ENDPOINT');
    const accessKeyId = this.configService.get<string>('RAILWAY_BUCKET_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('RAILWAY_BUCKET_SECRET_ACCESS_KEY');
    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new InternalServerErrorException(
        'Product image storage is not configured (RAILWAY_BUCKET_ENDPOINT/RAILWAY_BUCKET_ACCESS_KEY_ID/RAILWAY_BUCKET_SECRET_ACCESS_KEY missing)',
      );
    }
    // Railway Buckets use virtual-hosted-style URLs (bucket name as a
    // subdomain of the endpoint) — the AWS SDK's default (forcePathStyle
    // left unset/false), not the path-style some other S3-compatible
    // providers require.
    this.client = new S3Client({
      region: 'us-east-1', // arbitrary — Railway Buckets aren't AWS-region-scoped, but the SDK requires a value
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
    return this.client;
  }

  private getBucketName(): string {
    const bucket = this.configService.get<string>('RAILWAY_BUCKET_NAME');
    if (!bucket) {
      throw new InternalServerErrorException('Product image storage is not configured (RAILWAY_BUCKET_NAME missing)');
    }
    return bucket;
  }

  /** Flat key (no slashes) — keeps the GET /products/image/:key route a single path segment. */
  private buildKey(input: UploadImageInput): string {
    const extension = input.originalName.includes('.') ? input.originalName.split('.').pop() : 'jpg';
    return `${input.companyId}-${input.productId}-${Date.now()}.${extension}`;
  }

  async upload(input: UploadImageInput): Promise<string> {
    const client = this.getClient();
    const bucket = this.getBucketName();
    const key = this.buildKey(input);

    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: input.buffer,
          ContentType: input.mimeType,
        }),
      );
    } catch (error) {
      this.logger.error(`Railway Bucket upload failed: ${(error as Error).message}`);
      throw new InternalServerErrorException('Could not store the product image');
    }

    const publicApiBaseUrl = this.configService.getOrThrow<string>('PUBLIC_API_BASE_URL');
    return `${publicApiBaseUrl}/products/image/${key}`;
  }

  async get(key: string): Promise<StoredImage> {
    const client = this.getClient();
    const bucket = this.getBucketName();

    try {
      const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      return {
        stream: result.Body as Readable,
        contentType: result.ContentType ?? 'application/octet-stream',
      };
    } catch (error) {
      if (error instanceof NoSuchKey) {
        throw new NotFoundException('Image not found');
      }
      this.logger.error(`Railway Bucket read failed for key "${key}": ${(error as Error).message}`);
      throw new InternalServerErrorException('Could not retrieve the product image');
    }
  }
}
