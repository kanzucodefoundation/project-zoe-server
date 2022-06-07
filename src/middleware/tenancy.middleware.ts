import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { JwtHelperService } from "src/auth/jwt-helpers.service";
import { lowerCaseRemoveSpaces } from "src/utils/stringHelpers";

@Injectable()
export class TenancyMiddleware implements NestMiddleware {
  constructor(private readonly jwtService: JwtHelperService) {}

  async use(req: any, res: any, next: () => void) {
    let tenant = "";
    if (
      (req.originalUrl == "/api/auth/login" &&
        req.body.hasOwnProperty("churchName")) ||
      req.originalUrl == "/api/tenants" ||
      req.originalUrl == "/api/tenants/seed"
    ) {
      //@TODO Move this to custom middleware
      tenant = lowerCaseRemoveSpaces(req.body["churchName"]);
    } else {
      const jwtToken = req.headers.authorization.slice(7);
      const tokenPayload = await this.jwtService.decodeToken(jwtToken);
      tenant =
        tokenPayload && tokenPayload.hasOwnProperty("aud")
          ? tokenPayload.aud
          : "";
    }
    req.headers.tenant = tenant;
    Logger.log(`New request received from church: ${tenant}`);

    next();
  }
}
