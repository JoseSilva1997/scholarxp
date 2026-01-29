// @ModuleAccess allows routes to declare module-scoped permissions (param key + student read allowance).
import { SetMetadata } from '@nestjs/common';

export type ModuleAccessOptions = {
  paramKey?: string;
  allowStudentRead?: boolean;
};

export const MODULE_ACCESS_KEY = 'moduleAccess';

export const ModuleAccess = (options?: ModuleAccessOptions) =>
  SetMetadata(MODULE_ACCESS_KEY, options ?? {});
