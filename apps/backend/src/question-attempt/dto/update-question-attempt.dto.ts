import { PartialType } from '@nestjs/mapped-types';
import { CreateQuestionAttemptDto } from './create-question-attempt.dto';

export class UpdateQuestionAttemptDto extends PartialType(
  CreateQuestionAttemptDto,
) {}
