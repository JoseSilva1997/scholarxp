// Partial update shape for question content; questionData is explicitly redeclared to ensure
// TypeScript picks it up correctly through the PartialType generic transformation.
import { PartialType } from '@nestjs/mapped-types';
import { IsObject, IsOptional } from 'class-validator';
import type { QuestionData } from '@scholarxp/question-type-dtos';
import type { UpdateQuestionContentPayload } from '@scholarxp/api-contracts';
import { CreateQuestionContentDto } from './create-question-content.dto';

export class UpdateQuestionContentDto
  extends PartialType(CreateQuestionContentDto)
  implements UpdateQuestionContentPayload
{
  // Explicitly declare questionData to ensure TypeScript recognizes it when validating updates.
  @IsOptional()
  @IsObject()
  questionData?: QuestionData;
}
