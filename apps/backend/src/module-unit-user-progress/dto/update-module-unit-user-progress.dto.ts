import { PartialType } from '@nestjs/mapped-types';
import { CreateModuleUnitUserProgressDto } from './create-module-unit-user-progress.dto';

export class UpdateModuleUnitUserProgressDto extends PartialType(
  CreateModuleUnitUserProgressDto,
) {}
