import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationPort, LoggingNotificationAdapter } from './notification.port';
import { FcmNotificationAdapter } from './fcm-notification.adapter';
import { Msg91SmsAdapter } from './msg91-sms.adapter';
import { DevicesModule } from '../devices/devices.module';

@Module({
  imports: [DevicesModule],
  providers: [
    LoggingNotificationAdapter,
    FcmNotificationAdapter,
    // specs/014-msg91-sms-otp-mobile-verification — a separate, narrower
    // SMS service used only by registration mobile-verification, not part
    // of the FCM-based NotificationPort abstraction above.
    Msg91SmsAdapter,
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
  exports: [NotificationPort, Msg91SmsAdapter],
})
export class NotificationsModule {}
