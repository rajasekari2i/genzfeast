import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { FEEDBACK_CATEGORY_VALUES, FeedbackCategory } from '../feedback-category.constants';

/** Matches contracts/openapi.yaml's FeedbackCreateRequest. */
export class CreateFeedbackDto {
  /** Optional (FR-002). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsIn(FEEDBACK_CATEGORY_VALUES)
  category!: FeedbackCategory;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  message!: string;

  /** Optional; defaults to false (FR-005). */
  @IsOptional()
  @IsBoolean()
  contact_requested?: boolean;
}
