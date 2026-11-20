import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { AuthModule } from '../auth/auth.module';
import { DevicesModule } from '../devices/devices.module';

@Module({
  // Reuses AuthModule's already-exported PasswordService/TokenService/
  // AuthAuditService/AuthService rather than reimplementing password
  // hashing or session revocation a second time. DevicesModule is imported
  // directly (AuthModule consumes it but doesn't re-export it) for
  // delete-account's own push-registration cleanup.
  imports: [AuthModule, DevicesModule],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
