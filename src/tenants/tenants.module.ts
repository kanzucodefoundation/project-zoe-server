import { Module, Scope, Global, BadRequestException } from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import { TenantsService } from "./tenants.service";
import { DbService } from "src/shared/db.service";
import { SeedModule } from "src/seed/seed.module";
import { Tenant } from "./entities/tenant.entity";
import { TENANT_HEADER } from "../constants";
import { UsersModule } from "src/users/users.module";

const connectionFactory = {
  provide: "CONNECTION",
  scope: Scope.REQUEST,
  useFactory: async (req: any, dbservice: DbService) => {
    const tenantName = req.headers[TENANT_HEADER];
    const connectionPublic = await dbservice.getConnection();

    if (!tenantName) {
      throw new BadRequestException(
        "No church name provided. A valid church name must be provided.",
      );
    }

    const tenantDetails = await connectionPublic
      .getRepository(Tenant)
      .findOne({ where: { name: tenantName } });

    if (!tenantDetails) {
      throw new BadRequestException(
        "Invalid church name provided. Please provide a valid church name",
      );
    }

    return dbservice.getConnection(tenantName);
  },
  inject: [REQUEST, DbService],
};

@Global()
@Module({
  imports: [SeedModule, UsersModule],
  providers: [connectionFactory, TenantsService, DbService],
  exports: ["CONNECTION"],
})
export class TenantsModule {}
