import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { JwtHelperService } from 'src/auth/jwt-helpers.service';

/**
 * From the JWT, add a tenant header to the request
 */
@Injectable()
export class JwtTenantHeaderMiddleware implements NestMiddleware {
  constructor(private readonly jwtService: JwtHelperService) {}

  async use(req: any, res: any, next: () => void) {
    // @TODO Check if req.headers.authorization exists. Throw error if not
    const jwtToken = req.headers.authorization.slice(7);
    const tokenPayload = await this.jwtService.decodeToken(jwtToken);
    const tenant =
      tokenPayload && tokenPayload.hasOwnProperty('aud')
        ? tokenPayload.aud
        : '';

    req.headers.tenant = tenant;
    Logger.log(`New request received from church: ${tenant}`);

    next();
  }
}
