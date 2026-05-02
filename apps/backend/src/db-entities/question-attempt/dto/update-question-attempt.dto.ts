// All fields optional; in practice attempts are immutable once recorded, so updates are rare.
import { PartialType } from '@nestjs/mapped-types';
import { CreateQuestionAttemptDto } from './create-question-attempt.dto';

export class UpdateQuestionAttemptDto extends PartialType(
  CreateQuestionAttemptDto,
) {}
