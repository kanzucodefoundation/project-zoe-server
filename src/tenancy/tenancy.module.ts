import { Module, Scope, Global, BadRequestException } from "@nestjs/common";
import { getConnectionManager, createConnection } from "typeorm";
import { REQUEST } from "@nestjs/core";
import config, { appEntities } from "../config";
import * as dotenv from "dotenv";

const connectionFactory = {
  provide: "CONNECTION",
  scope: Scope.REQUEST,
  useFactory: async (req) => {
    const tenantName = req.headers["tenant"];
    const connectionManager = getConnectionManager();
    const connectionPublic = connectionManager.get("default");
    const allTenants = ["demo", "worshipharvest", "vive"];

    //const tenantDetails = await connectionPublic.getRepository(Tenant).findOne({code: tenantName})

    if (!tenantName) {
      throw new BadRequestException(
        "No church name provided. A valid church name must be provided.",
      );
    }
    if (!allTenants.includes(tenantName)) {
      throw new BadRequestException("Invalid church name provided.");
    }

    //const tenancy = tenantDetails.code

    const connectionName = `${process.env.DB_DATABASE}_${tenantName}`;

    if (connectionManager.has(connectionName)) {
      const connection = await connectionManager.get(connectionName);
      return Promise.resolve(
        connection.isConnected ? connection : connection.connect(),
      );
    } else {
      await createConnection({
        ...config.database,
        name: connectionName,
        type: "postgres",
        database: connectionName,
        entities: appEntities,
      });

      const connection = await connectionManager.get(connectionName);
      return Promise.resolve(
        connection.isConnected ? connection : connection.connect(),
      );
    }
  },
  inject: [REQUEST],
};

@Global()
@Module({
  providers: [connectionFactory],
  exports: ["CONNECTION"],
})
export class TenancyModule {}
