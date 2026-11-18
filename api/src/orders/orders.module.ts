import { Module } from '@nestjs/common';
import { StaffOrdersController } from './staff-orders.controller';
import { StaffOrdersService } from './staff-orders.service';
import { StudentOrdersController } from './student-orders.controller';
import { StudentOrdersService } from './student-orders.service';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationsModule } from '../notifications/notifications.module';

/**
 * One Order entity, one module — specs/005 (Staff fulfilment) and specs/006
 * (Student browse/cart/checkout, specs/008's My Orders extension) both
 * operate on the same `orders` table, so they're split into per-audience
 * controllers/services within a single module rather than two separate
 * modules. `PaymentsModule` is imported here (not by StudentOrdersService's
 * own would-be module) since only the student-facing half needs
 * `RazorpayService`. `NotificationsModule` is imported for
 * StaffOrdersService.markReady's "Order Ready for Pickup!" push — without
 * it Nest cannot resolve NotificationPort, and nothing in the TypeScript
 * build catches that; it surfaces only when the app boots.
 */
@Module({
  imports: [PaymentsModule, NotificationsModule],
  controllers: [StaffOrdersController, StudentOrdersController],
  providers: [StaffOrdersService, StudentOrdersService],
})
export class OrdersModule {}
