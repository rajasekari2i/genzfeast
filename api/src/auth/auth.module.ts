import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { AuthAuditService } from './auth-audit.service';
import { OtpService } from './otp.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { DevicesModule } from '../devices/devices.module';

// PrismaModule and GuardsModule are both @Global() (specs/001) — their
// providers (TenantPrismaService, JwtService, JwtAuthGuard) are already
// available without a re-import here, matching CompaniesModule's own
// precedent.
@Module({
  imports: [NotificationsModule, DevicesModule],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, TokenService, AuthAuditService, OtpService],
  exports: [AuthService, PasswordService, TokenService, AuthAuditService],
})
export class AuthModule {}
