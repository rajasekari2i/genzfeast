import { Module } from '@nestjs/common';
import { FeedbackController } from './feedback.controller';
import { TenantFeedbackController } from './tenant-feedback.controller';
import { FeedbackService } from './feedback.service';

@Module({
  controllers: [FeedbackController, TenantFeedbackController],
  providers: [FeedbackService],
})
export class FeedbackModule {}
