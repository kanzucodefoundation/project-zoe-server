import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { JwtHelperService } from 'src/auth/jwt-helpers.service';

/**
 * From the JWT, add a tenant header to the request
 */
@Injectable()
export class JwtTenantHeaderMiddleware implements NestMiddleware {
  constructor(private readonly jwtService: JwtHelperService) {}

  async use(req: any, res: any, next: () => void) {
    // Safely handle missing Authorization header
    const authHeader =
      req?.headers?.authorization || req?.headers?.Authorization;
    if (!authHeader) {
      // No auth header present; don't set tenant and continue
      return next();
    }

    // Support 'Bearer <token>' or raw token
    const jwtToken = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    try {
      const verifiedPayload = await this.jwtService.verifyToken(jwtToken);
      const tenantValue = verifiedPayload?.aud;
      const tenant =
        typeof tenantValue === 'string'
          ? tenantValue
          : Array.isArray(tenantValue)
          ? tenantValue.find(
              (value): value is string =>
                typeof value === 'string' && value.trim().length > 0,
            ) || ''
          : '';
      if (tenant) {
        req.headers.tenant = tenant;
        Logger.log(`New request received from church: ${tenant}`);
      }
    } catch (err) {
      Logger.warn(
        'Failed to verify JWT in JwtTenantHeaderMiddleware',
        err?.message || err,
      );
      // proceed without tenant header on decode failure
    }

    return next();
  }
}
