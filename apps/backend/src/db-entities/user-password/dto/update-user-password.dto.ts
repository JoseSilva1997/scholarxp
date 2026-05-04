// Used when rotating a password; callers must supply the new bcrypt hash in passwordHash.
import { PartialType } from '@nestjs/mapped-types';
import { CreateUserPasswordDto } from './create-user-password.dto';

export class UpdateUserPasswordDto extends PartialType(CreateUserPasswordDto) {}
