import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'requiredPermissions';

/**
 * Marks a route as requiring one or more of the listed permissions.
 *
 * Read by `PermissionsGuard`. A route with no such marker is unaffected, so
 * this can be applied endpoint by endpoint without changing anything else.
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
