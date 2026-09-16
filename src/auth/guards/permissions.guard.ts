import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { roleAdmin } from '../constants';

/**
 * Checks the permissions carried by the caller's JWT against the ones a route
 * declares with `@RequirePermissions()`.
 *
 * `JwtAuthGuard` establishes *who* the caller is and nothing more — it does not
 * look at roles or permissions. Every authenticated user of a tenant therefore
 * reaches every non-public handler, which is fine for routes whose damage is
 * contained but not for ones that rewrite accounting configuration.
 *
 * Use it alongside `JwtAuthGuard`, never instead of it: this guard reads
 * `request.user`, which the JWT guard is what populates.
 *
 * Permissions reach the token through `AuthService.generateToken`, which
 * resolves them from the user's roles. A route with no `@RequirePermissions()`
 * is allowed through untouched, so adding this guard to a controller changes
 * the behaviour only of the handlers that opt in.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) {
      return true;
    }

    const user = context.switchToHttp().getRequest()?.user;
    if (!user) {
      throw new ForbiddenException(
        'You do not have permission to perform this action.',
      );
    }

    // An administrator holds every permission by definition — see `roleAdmin`
    // in auth/constants, whose permission list is the full set.
    const roles: string[] = Array.isArray(user.roles) ? user.roles : [];
    if (roles.includes(roleAdmin.role)) {
      return true;
    }

    const held: string[] = Array.isArray(user.permissions)
      ? user.permissions
      : [];
    if (required.some((permission) => held.includes(permission))) {
      return true;
    }

    throw new ForbiddenException(
      `You do not have permission to perform this action. Required: ${required.join(
        ' or ',
      )}.`,
    );
  }
}
