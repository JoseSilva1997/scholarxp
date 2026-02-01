// ModuleAccess decorator conveys module-scoped authorization options to ModuleAccessGuard.
import { SetMetadata } from '@nestjs/common';

export type ModuleAccessOptions = {
  // Optional override for param key; defaults to 'moduleId'.
  paramKey?: string;
  // Allow student read-only when true; otherwise students are blocked.
  allowStudentRead?: boolean;
};

export const MODULE_ACCESS_KEY = 'module_access';
export const ModuleAccess = (options: ModuleAccessOptions = {}) =>
  SetMetadata(MODULE_ACCESS_KEY, options);
