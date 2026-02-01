// Roles decorator stores required global roles as metadata for RolesGuard.
import { SetMetadata } from '@nestjs/common';
import { GlobalRole } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: GlobalRole[]) => SetMetadata(ROLES_KEY, roles);
