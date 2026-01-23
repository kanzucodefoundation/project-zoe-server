import {
  Module,
  Scope,
  Global,
  BadRequestException,
  forwardRef,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { TenantsService } from './tenants.service';
import { DbService } from 'src/shared/db.service';
import { SeedModule } from 'src/seed/seed.module';
import { Tenant } from './entities/tenant.entity';
import { TENANT_HEADER } from '../constants';
import { UsersModule } from 'src/users/users.module';
import { TenantContext } from 'src/shared/tenant/tenant-context';

/**
 * Tenant validation provider - validates tenant and stores tenantId in request
 * This is REQUEST-scoped to run for each request
 */
const tenantValidationProvider = {
  provide: 'TENANT_VALIDATOR',
  scope: Scope.REQUEST,
  useFactory: async (req: any, dbservice: DbService) => {
    // Check if this is a JWT authenticated request (has Authorization header)
    const authHeader = req.headers.authorization;
    const hasJWT = authHeader && authHeader.startsWith('Bearer ');

    // For JWT requests, skip tenant header validation (interceptor will handle it)
    if (hasJWT) {
      return null; // Return null to indicate JWT-based tenant resolution
    }

    // For non-JWT requests, require tenant header (public routes like login, register)
    const tenantName = req.headers[TENANT_HEADER];

    if (!tenantName) {
      throw new BadRequestException(
        'No church name provided. A valid church name must be provided.',
      );
    }

    const tenantDetails = await dbservice.getTenantByName(tenantName);

    if (!tenantDetails) {
      throw new BadRequestException(
        'Invalid church name provided. Please provide a valid church name',
      );
    }

    // Store tenant ID in request for TenantContext to use
    req.tenantId = tenantDetails.id;
    req.tenantName = tenantDetails.name;

    return tenantDetails;
  },
  inject: [REQUEST, DbService],
};

/**
 * Connection provider - now returns the single database connection
 * Kept for backward compatibility with existing code
 */
const connectionFactory = {
  provide: 'CONNECTION',
  scope: Scope.REQUEST,
  useFactory: async (
    req: any,
    dbservice: DbService,
    tenantValidator: Tenant | null,
  ) => {
    // tenantValidator dependency ensures tenant is validated before getting connection
    // tenantValidator can be null for JWT-authenticated requests (handled by interceptor)
    return dbservice.getConnection();
  },
  inject: [REQUEST, DbService, 'TENANT_VALIDATOR'],
};

@Global()
@Module({
  imports: [forwardRef(() => SeedModule), forwardRef(() => UsersModule)],
  providers: [
    tenantValidationProvider,
    connectionFactory,
    TenantsService,
    DbService,
    TenantContext,
  ],
  exports: ['CONNECTION', 'TENANT_VALIDATOR', TenantContext],
})
export class TenantsModule {}
