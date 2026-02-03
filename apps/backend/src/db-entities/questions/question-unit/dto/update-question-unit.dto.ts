import { PartialType } from '@nestjs/mapped-types';
import { CreateQuestionUnitDto } from './create-question-unit.dto';

export class UpdateQuestionUnitDto extends PartialType(CreateQuestionUnitDto) {}
