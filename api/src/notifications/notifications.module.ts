import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationPort, LoggingNotificationAdapter } from './notification.port';
import { FcmNotificationAdapter } from './fcm-notification.adapter';
import { DevicesModule } from '../devices/devices.module';

@Module({
  imports: [DevicesModule],
  providers: [
    LoggingNotificationAdapter,
    FcmNotificationAdapter,
    {
      provide: NotificationPort,
      // Firebase is optional (env.validation.ts) — fall back to the logging
      // no-op adapter whenever it isn't fully configured, rather than
      // failing startup (specs/003 User Story 3: the flow already tolerates
      // zero pushes ever arriving).
      useFactory: (
        configService: ConfigService,
        fcmAdapter: FcmNotificationAdapter,
        loggingAdapter: LoggingNotificationAdapter,
      ): NotificationPort => {
        const configured =
          configService.get<string>('FIREBASE_PROJECT_ID') &&
          configService.get<string>('FIREBASE_CLIENT_EMAIL') &&
          configService.get<string>('FIREBASE_PRIVATE_KEY');
        return configured ? fcmAdapter : loggingAdapter;
      },
      inject: [ConfigService, FcmNotificationAdapter, LoggingNotificationAdapter],
    },
  ],
  exports: [NotificationPort],
})
export class NotificationsModule {}
