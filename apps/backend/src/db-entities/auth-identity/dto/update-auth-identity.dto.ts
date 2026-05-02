// All fields from CreateAuthIdentityDto become optional, enabling partial updates.
import { PartialType } from '@nestjs/mapped-types';
import { CreateAuthIdentityDto } from './create-auth-identity.dto';

export class UpdateAuthIdentityDto extends PartialType(CreateAuthIdentityDto) {}
