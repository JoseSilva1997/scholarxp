import { PartialType } from '@nestjs/mapped-types';
import { CreateLtiIdentityDto } from './create-lti-identity.dto';

export class UpdateLtiIdentityDto extends PartialType(CreateLtiIdentityDto) {}
