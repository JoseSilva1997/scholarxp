// All fields become optional; used primarily for patching status (draft → live) and title.
import { PartialType } from '@nestjs/mapped-types';
import { CreateModuleUnitDto } from './create-module-unit.dto';
import { UpdateModuleUnitPayload } from '@scholarxp/api-contracts';

export class UpdateModuleUnitDto
  extends PartialType(CreateModuleUnitDto)
  implements UpdateModuleUnitPayload {}
