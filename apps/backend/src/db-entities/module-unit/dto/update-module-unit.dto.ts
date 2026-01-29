import { PartialType } from '@nestjs/mapped-types';
import { CreateModuleUnitDto } from './create-module-unit.dto';

export class UpdateModuleUnitDto extends PartialType(CreateModuleUnitDto) {}
