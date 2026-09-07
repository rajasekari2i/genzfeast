import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';
import { validateWebhookSignature } from 'razorpay/dist/utils/razorpay-utils';

export interface CreatedGatewayOrder {
  gatewayRef: string;
}

/**
 * specs/006-student-browse-cart-checkout research.md §4 — Architecture §7's
 * "critical design rule": only a verified server-to-server webhook, never
 * the client's own redirect, finalizes payment. Pure gateway-client wrapper,
 * no DB access — StudentOrdersService/PaymentsService own persistence.
 */
@Injectable()
export class RazorpayService {
  private client: Razorpay | null = null;

  constructor(private readonly configService: ConfigService) {}

  private getClient(): Razorpay {
    if (this.client) {
      return this.client;
    }
    const keyId = this.configService.get<string>('RAZORPAY_KEY_ID');
    const keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET');
    if (!keyId || !keySecret) {
      throw new InternalServerErrorException(
        'Payment gateway is not configured (RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET missing)',
      );
    }
    this.client = new Razorpay({ key_id: keyId, key_secret: keySecret });
    return this.client;
  }

  /** `amount` is in the smallest currency unit (paise), matching orders.total_amount's own convention. */
  async createOrder(amount: number, receipt: string): Promise<CreatedGatewayOrder> {
    const client = this.getClient();
    const order = await client.orders.create({ amount, currency: 'INR', receipt });
    return { gatewayRef: order.id };
  }

  /**
   * HMAC-SHA256 over the RAW request body, using Razorpay's own SDK utility
   * (never a re-serialized JSON object, which can byte-differ from what was
   * actually signed). Returns false — never throws — for missing
   * configuration/header/body, so the controller can uniformly reject with
   * 400 regardless of which precondition failed.
   */
  verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
    const webhookSecret = this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET');
    if (!webhookSecret || !signatureHeader || !rawBody?.length) {
      return false;
    }
    try {
      return validateWebhookSignature(rawBody.toString('utf8'), signatureHeader, webhookSecret);
    } catch {
      return false;
    }
  }
}
