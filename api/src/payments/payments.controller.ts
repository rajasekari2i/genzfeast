import { BadRequestException, Controller, Headers, HttpCode, HttpStatus, Post, RawBodyRequest, Req } from '@nestjs/common';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';

/**
 * specs/006-student-browse-cart-checkout contracts/openapi.yaml —
 * /payments/webhook. Called by Razorpay, not the mobile client — no
 * JwtAuthGuard/RolesGuard; authenticated by signature instead (see
 * PaymentsService.handleWebhook).
 */
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature: string | undefined,
  ): Promise<{ received: true }> {
    if (!req.rawBody) {
      throw new BadRequestException('Missing request body');
    }
    await this.paymentsService.handleWebhook(req.rawBody, signature, req.body);
    return { received: true };
  }
}
