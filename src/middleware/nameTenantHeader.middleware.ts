import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { lowerCaseRemoveSpaces } from "src/utils/stringHelpers";
import { TENANT_NAME_FIELD, TENANT_HEADER } from "../constants";
import { hasNoValue } from "../utils/validation";

/**
 * From the churchName field in the body of the request,
 * add a tenant header
 */
@Injectable()
export class nameTenantHeaderMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    Logger.log(`running middleware: ${req.headers[TENANT_HEADER]}`);
    if (hasNoValue(req.headers[TENANT_HEADER])) {
      const churchName = req.body.hasOwnProperty(TENANT_NAME_FIELD)
        ? req.body[TENANT_NAME_FIELD]
        : req.query[TENANT_NAME_FIELD];
      const tenant = lowerCaseRemoveSpaces(churchName);
      req.headers[TENANT_HEADER] = tenant;
      Logger.log(`New request received from church: ${tenant}`);
    } else {
      Logger.log(
        `New request received from church: ${req.headers[TENANT_HEADER]}`,
      );
    }
    next();
  }
}
