// All fields optional; typically used to update the title or reorder a question unit.
import { PartialType } from '@nestjs/mapped-types';
import { CreateQuestionUnitDto } from './create-question-unit.dto';

export class UpdateQuestionUnitDto extends PartialType(CreateQuestionUnitDto) {}
