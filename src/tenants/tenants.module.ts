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
 * OAuth callback paths that must bypass tenant-header validation.
 *
 * WHY THIS EXISTS
 * ---------------
 * The TENANT_VALIDATOR factory below runs on every request. It has two valid
 * passes: (1) a Bearer JWT is present → skip; (2) no JWT → require the
 * x-tenant-name header set by TenantHeaderMiddleware (used by login / register).
 * OAuth callbacks from third-party providers (Intuit, Stripe, Google, etc.) are
 * raw browser redirects that carry neither a JWT nor a tenant header. They hit
 * the factory before NestJS reaches any controller, so they would otherwise
 * throw a 400 before your handler ever runs.
 *
 * WHEN TO ADD AN ENTRY
 * --------------------
 * Add the path prefix of any callback endpoint that:
 *   - is triggered by a third-party redirect (not by the app itself), AND
 *   - is decorated with @Public() in its controller, AND
 *   - resolves the tenant itself (e.g. from an OAuth `state` param or a
 *     signed cookie) rather than from a header.
 *
 * WHAT THE COUNTERPART CONTROLLER CHANGE LOOKS LIKE
 * --------------------------------------------------
 * The matching endpoint must be @Public() so the JWT guard skips it, and it
 * must not rely on req.tenantId being set by TenantContextInterceptor.
 * See QuickBooksController.callback() for the reference implementation.
 *
 * ANALOGY TO AppModule.configure()
 * ---------------------------------
 * AppModule.configure() / forRoutes() controls which routes
 * TenantHeaderMiddleware runs on. This list is the equivalent control for the
 * TENANT_VALIDATOR factory — routes here are opted out of header-based tenant
 * resolution entirely.
 */
const OAUTH_CALLBACK_PATHS = [
  '/api/integrations/quickbooks/callback',
  // '/api/integrations/stripe/callback',   ← example for the next provider
];

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

    // Third-party OAuth redirects carry no JWT and no tenant header.
    // See OAUTH_CALLBACK_PATHS above for criteria and how to extend this.
    const url: string = req.url ?? '';
    if (OAUTH_CALLBACK_PATHS.some((p) => url.startsWith(p))) {
      return null;
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
