import { PartialType } from '@nestjs/mapped-types';
import { CreateModuleInviteDto } from './create-module-invite.dto';

export class UpdateModuleInviteDto extends PartialType(CreateModuleInviteDto) {}
