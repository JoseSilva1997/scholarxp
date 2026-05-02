// All fields become optional, allowing the practice session to patch only the fields that changed.
import { PartialType } from '@nestjs/mapped-types';
import { CreateModuleUnitUserProgressDto } from './create-module-unit-user-progress.dto';

export class UpdateModuleUnitUserProgressDto extends PartialType(
  CreateModuleUnitUserProgressDto,
) {}
