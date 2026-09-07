import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface UploadImageInput {
  companyId: string;
  productId: string;
  buffer: Buffer;
  mimeType: string;
  originalName: string;
}

/**
 * Seam between ProductsService and whatever actually stores the photo
 * (specs/004-company-admin-product-crud research.md §1: Supabase Storage,
 * Architecture §1's own decision) — mirrors the NotificationPort pattern
 * from specs/003. ProductsService depends on this interface, not a concrete
 * Supabase client, so a not-yet-configured environment fails clearly at
 * upload time rather than blocking the whole app from booting.
 */
export abstract class ProductImageStoragePort {
  abstract upload(input: UploadImageInput): Promise<string>;
}

@Injectable()
export class SupabaseProductImageStorageAdapter extends ProductImageStoragePort {
  private readonly logger = new Logger(SupabaseProductImageStorageAdapter.name);
  private client: SupabaseClient | null = null;
  // Company ids already known to have a bucket, so a hot upload path
  // doesn't re-check bucket existence via an extra round-trip every time —
  // this only needs to happen once per company per process lifetime (a
  // false negative just means one harmless extra getBucket/createBucket
  // call after a restart).
  private readonly bucketsEnsured = new Set<string>();

  constructor(private readonly configService: ConfigService) {
    super();
  }

  private getClient(): SupabaseClient {
    if (this.client) {
      return this.client;
    }
    const url = this.configService.get<string>('SUPABASE_URL');
    const serviceRoleKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceRoleKey) {
      throw new InternalServerErrorException(
        'Product image upload is not configured (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY missing)',
      );
    }
    this.client = createClient(url, serviceRoleKey);
    return this.client;
  }

  /**
   * One bucket per Company, named by its company_id — a real UUID is
   * already a valid Supabase Storage bucket id (lowercase hex + hyphens),
   * so no sanitizing/mapping is needed. Created on first use, public (a
   * product photo has to be viewable by any Student browsing the menu,
   * with no auth token attached to an <Image> request).
   */
  private async ensureBucketExists(client: SupabaseClient, bucket: string): Promise<void> {
    if (this.bucketsEnsured.has(bucket)) {
      return;
    }
    const { data: existing } = await client.storage.getBucket(bucket);
    if (existing) {
      this.bucketsEnsured.add(bucket);
      return;
    }
    const { error } = await client.storage.createBucket(bucket, { public: true });
    // A concurrent upload for the same Company may have created it a moment
    // earlier — that race is benign, not a real failure.
    if (error && !/already exists/i.test(error.message)) {
      this.logger.error(`Could not create Supabase Storage bucket "${bucket}": ${error.message}`);
      throw new InternalServerErrorException('Could not prepare storage for this company');
    }
    this.bucketsEnsured.add(bucket);
  }

  async upload(input: UploadImageInput): Promise<string> {
    const client = this.getClient();
    const bucket = input.companyId;
    await this.ensureBucketExists(client, bucket);

    const extension = input.originalName.includes('.') ? input.originalName.split('.').pop() : 'jpg';
    const path = `${input.productId}-${Date.now()}.${extension}`;

    const { error } = await client.storage
      .from(bucket)
      .upload(path, input.buffer, { contentType: input.mimeType, upsert: true });
    if (error) {
      this.logger.error(`Supabase Storage upload failed: ${error.message}`);
      throw new InternalServerErrorException('Could not store the product image');
    }

    const { data } = client.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }
}
