// All fields become optional for partial updates; used rarely as variants are typically replaced rather than patched.
import { PartialType } from '@nestjs/mapped-types';
import { CreateQuestionVariantDto } from './create-question-variant.dto';

export class UpdateQuestionVariantDto extends PartialType(
  CreateQuestionVariantDto,
) {}
