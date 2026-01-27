// Defines the role update payload so role changes can be validated separately from profile updates.
import { GlobalRole } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateUserRoleDto {
  @IsEnum(GlobalRole)
  globalRole: GlobalRole;
}
