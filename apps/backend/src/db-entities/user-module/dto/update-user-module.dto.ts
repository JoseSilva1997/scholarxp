// All fields optional; used to adjust role, level, or XP for administrative corrections.
import { PartialType } from '@nestjs/mapped-types';
import { CreateUserModuleDto } from './create-user-module.dto';

export class UpdateUserModuleDto extends PartialType(CreateUserModuleDto) {}
