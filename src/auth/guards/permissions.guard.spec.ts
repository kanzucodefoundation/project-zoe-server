import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { appPermissions, roleAdmin } from '../constants';

/**
 * The global JwtAuthGuard answers "who is this?" and stops there, so before
 * this guard existed every authenticated user of a tenant could rewrite the
 * QuickBooks mappings that decide which ledger account a gift posts against.
 * These cover the two ways that must not regress: a route that declares a
 * permission is closed to anyone without it, and a route that declares none is
 * left exactly as it was.
 */
describe('PermissionsGuard', () => {
  const guard = new PermissionsGuard(new Reflector());

  const contextFor = (user: any, required?: string[]) => {
    const context: any = {
      getHandler: () => 'handler',
      getClass: () => 'class',
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    };
    jest
      .spyOn(guard['reflector'], 'getAllAndOverride')
      .mockReturnValue(required as any);
    return context;
  };

  it('lets a route with no declared permission through untouched', () => {
    expect(guard.canActivate(contextFor(undefined, undefined))).toBe(true);
  });

  it('treats an empty permission list as no requirement', () => {
    expect(guard.canActivate(contextFor({ permissions: [] }, []))).toBe(true);
  });

  it('allows a user holding the required permission', () => {
    const user = { permissions: [appPermissions.roleFinanceEdit] };
    expect(
      guard.canActivate(contextFor(user, [appPermissions.roleFinanceEdit])),
    ).toBe(true);
  });

  it('allows an administrator, who holds every permission by definition', () => {
    const user = { roles: [roleAdmin.role], permissions: [] };
    expect(
      guard.canActivate(contextFor(user, [appPermissions.roleFinanceEdit])),
    ).toBe(true);
  });

  it('refuses an authenticated user without the permission', () => {
    const user = { roles: [], permissions: [appPermissions.roleCrmView] };
    expect(() =>
      guard.canActivate(contextFor(user, [appPermissions.roleFinanceEdit])),
    ).toThrow(ForbiddenException);
  });

  it('refuses when the request carries no user at all', () => {
    expect(() =>
      guard.canActivate(
        contextFor(undefined, [appPermissions.roleFinanceEdit]),
      ),
    ).toThrow(ForbiddenException);
  });

  it('names the missing permission so the refusal is actionable', () => {
    const user = { roles: [], permissions: [] };
    expect(() =>
      guard.canActivate(contextFor(user, [appPermissions.roleFinanceEdit])),
    ).toThrow(/FINANCE_EDIT/);
  });

  it('survives a token whose permissions claim is not an array', () => {
    const user = { roles: 'RoleAdmin', permissions: 'FINANCE_EDIT' };
    expect(() =>
      guard.canActivate(contextFor(user, [appPermissions.roleFinanceEdit])),
    ).toThrow(ForbiddenException);
  });
});
