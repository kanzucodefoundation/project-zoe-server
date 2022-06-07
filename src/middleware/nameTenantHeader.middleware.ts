import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { lowerCaseRemoveSpaces } from "src/utils/stringHelpers";

/**
 * From the churchName field in the body of the request,
 * add a tenant header
 */
@Injectable()
export class nameTenantHeaderMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    const tenant = lowerCaseRemoveSpaces(req.body["churchName"]);
    req.headers.tenant = tenant;
    Logger.log(`New request received from church: ${tenant}`);
    next();
  }
}
