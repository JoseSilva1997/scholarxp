import { PartialType } from '@nestjs/mapped-types';
import { CreateQuestionVariantDto } from './create-question-variant.dto';

export class UpdateQuestionVariantDto extends PartialType(
  CreateQuestionVariantDto,
) {}
