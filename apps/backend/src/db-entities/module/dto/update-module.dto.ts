// Partial update shape for a module; typically used to update the title or description.
import { PartialType } from '@nestjs/mapped-types';
import { CreateModuleDto } from './create-module.dto';
import { UpdateModulePayload } from '@scholarxp/api-contracts';

export class UpdateModuleDto
  extends PartialType(CreateModuleDto)
  implements UpdateModulePayload {}
