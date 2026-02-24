// Defines the role update payload so role changes can be validated separately from profile updates.
import { GlobalRole } from '@prisma/client';
import { IsEnum, IsIn } from 'class-validator';

export class UpdateUserRoleDto {
  @IsEnum(GlobalRole)
  @IsIn([GlobalRole.student, GlobalRole.teacher], {
    message: 'You must select either student or teacher role',
  })
  globalRole: GlobalRole;
}
