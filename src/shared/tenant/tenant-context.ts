import { Injectable, Scope, Inject } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { TENANT_HEADER } from '../../constants';

/**
 * TenantContext - Provides access to the current tenant information
 *
 * This is a REQUEST-scoped service that extracts and provides tenant context
 * for the current request.
 */
@Injectable({ scope: Scope.REQUEST })
export class TenantContext {
  constructor(@Inject(REQUEST) private readonly request: any) {}

  get tenantId(): number | null {
    // Lazily read from request to ensure tenant validator has run
    return this.request?.tenantId || null;
  }

  get tenantName(): string | null {
    // Lazily read from request header
    return this.request?.headers?.[TENANT_HEADER] || this.request?.tenantName || null;
  }

  setTenantId(tenantId: number): void {
    if (this.request) {
      this.request.tenantId = tenantId;
    }
  }

  hasTenant(): boolean {
    return this.tenantId !== null;
  }

  requireTenant(): number {
    const tenantId = this.tenantId;
    if (!tenantId) {
      throw new Error('Tenant context is required but not available');
    }
    return tenantId;
  }
}
