import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { JwtHelperService } from "src/auth/jwt-helpers.service";

/**
 * From the JWT, add a tenant header to the request
 */
@Injectable()
export class JwtTenantHeaderMiddleware implements NestMiddleware {
  constructor(private readonly jwtService: JwtHelperService) {}

  async use(req: any, res: any, next: () => void) {
    let tenant = await this.getTenantFromJwt(req);
    if (!tenant) {
      tenant = this.getTenantFromQueryParam(req);
    }
    if (!tenant) {
      // TODO: confirm with peter if this is the right place to throw
      // throw new Error("No tenant found in request");
    }
    req.headers.tenant = tenant;
    Logger.log(`New request received from church: ${tenant}`);
    next();
  }

  private async getTenantFromJwt(req: any) {
    try {
      const jwtToken = req.headers.authorization?.slice(7);
      const tokenPayload = await this.jwtService.decodeToken(jwtToken);
      return tokenPayload && tokenPayload.hasOwnProperty("aud")
        ? tokenPayload.aud
        : "";
    } catch (e) {
      Logger.log(`no tenant found in jwt` + e.message);
    }
  }

  private getTenantFromQueryParam(req: any) {
    // this is useful for USSD endpoints
    try {
      return req.query.tenant;
    } catch (e) {
      Logger.log(`no tenant found in query param` + e.message);
    }
  }
}
