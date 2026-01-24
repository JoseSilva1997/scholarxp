import { PartialType } from '@nestjs/mapped-types';
import { CreateAuthIdentityDto } from './create-auth-identity.dto';

export class UpdateAuthIdentityDto extends PartialType(CreateAuthIdentityDto) {}
