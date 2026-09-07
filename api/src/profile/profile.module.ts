import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  // Reuses AuthModule's already-exported PasswordService/TokenService/
  // AuthAuditService/AuthService rather than reimplementing password
  // hashing or session revocation a second time.
  imports: [AuthModule],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
