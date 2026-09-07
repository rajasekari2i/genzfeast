import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { RazorpayService } from './razorpay.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  // specs/009 FR-004 — the webhook's success transition sends the
  // order-ready push via the same NotificationPort seam specs/003 built.
  imports: [NotificationsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, RazorpayService],
  exports: [RazorpayService],
})
export class PaymentsModule {}
