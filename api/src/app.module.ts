import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './common/config/env.validation';
import { PrismaModule } from './common/prisma/prisma.module';
import { GuardsModule } from './common/guards/guards.module';
import { CompaniesModule } from './companies/companies.module';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { DepartmentsModule } from './departments/departments.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { ProfileModule } from './profile/profile.module';
import { DevicesModule } from './devices/devices.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    GuardsModule,
    CompaniesModule,
    AuthModule,
    CategoriesModule,
    DepartmentsModule,
    UsersModule,
    ProductsModule,
    OrdersModule,
    PaymentsModule,
    ProfileModule,
    // Was already transitively available via AuthModule -> NotificationsModule
    // -> DevicesModule; imported explicitly here too now that it has its own
    // public controller (POST /me/devices, specs/009), for clarity.
    DevicesModule,
  ],
})
export class AppModule {}
