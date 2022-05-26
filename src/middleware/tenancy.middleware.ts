import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { JwtHelperService } from "src/auth/jwt-helpers.service";

@Injectable()
export class TenancyMiddleware implements NestMiddleware {
  constructor(private readonly jwtService: JwtHelperService) {}

  async use(req: any, res: any, next: () => void) {
    let tenant = "";
    if (
      req.originalUrl == "/api/auth/login" &&
      req.body.hasOwnProperty("churchName")
    ) {
      tenant = req.body["churchName"].toLowerCase().replace(/\s/g, "");
    } else {
      const jwtToken = req.headers.authorization.slice(7);
      const tokenPayload = await this.jwtService.decodeToken(jwtToken);
      tenant =
        tokenPayload && tokenPayload.hasOwnProperty("aud")
          ? tokenPayload.aud
          : "";
    }
    req.headers.tenant = tenant;
    Logger.log(`New request received. Church: ${tenant}`);

    next();
  }
}
