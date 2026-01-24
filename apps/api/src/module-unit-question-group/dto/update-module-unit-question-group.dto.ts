import { PartialType } from '@nestjs/mapped-types';
import { CreateModuleUnitQuestionGroupDto } from './create-module-unit-question-group.dto';

export class UpdateModuleUnitQuestionGroupDto extends PartialType(
  CreateModuleUnitQuestionGroupDto,
) {}
