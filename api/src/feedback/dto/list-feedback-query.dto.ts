import { IsIn, IsOptional } from 'class-validator';
import { FEEDBACK_STATUS_VALUES, FeedbackStatus } from '../feedback-category.constants';

/** Matches contracts/openapi.yaml's StatusFilterParam — omit to return every status. */
export class ListFeedbackQueryDto {
  @IsOptional()
  @IsIn(FEEDBACK_STATUS_VALUES)
  status?: FeedbackStatus;
}
