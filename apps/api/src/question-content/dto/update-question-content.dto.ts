import { PartialType } from '@nestjs/mapped-types';
import { CreateQuestionContentDto } from './create-question-content.dto';

export class UpdateQuestionContentDto extends PartialType(CreateQuestionContentDto) {}
