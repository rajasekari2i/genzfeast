import { Module } from '@nestjs/common';
import { StaffOrdersController } from './staff-orders.controller';
import { StaffOrdersService } from './staff-orders.service';
import { StudentOrdersController } from './student-orders.controller';
import { StudentOrdersService } from './student-orders.service';
import { PaymentsModule } from '../payments/payments.module';

/**
 * One Order entity, one module — specs/005 (Staff fulfilment) and specs/006
 * (Student browse/cart/checkout, specs/008's My Orders extension) both
 * operate on the same `orders` table, so they're split into per-audience
 * controllers/services within a single module rather than two separate
 * modules. `PaymentsModule` is imported here (not by StudentOrdersService's
 * own would-be module) since only the student-facing half needs
 * `RazorpayService`.
 */
@Module({
  imports: [PaymentsModule],
  controllers: [StaffOrdersController, StudentOrdersController],
  providers: [StaffOrdersService, StudentOrdersService],
})
export class OrdersModule {}
