import { Injectable, Global, Logger } from "@nestjs/common";
import { getConnectionManager, createConnection } from "typeorm";
import * as dotenv from "dotenv";
import config, { appEntities } from "../config";
import { Tenant } from "src/tenants/entities/tenant.entity";
import { TenantDto } from "src/tenants/dto/tenant.dto";

@Injectable()
export class DbService {
  async getConnection(tenantName: string = "public") {
    const connectionManager = getConnectionManager();
    const connectionName = this.getConnectionName(tenantName);

    Logger.log(`Getting Db connection ${connectionName}`);

    if (connectionManager.has(connectionName)) {
      const connection = await connectionManager.get(connectionName);
      return Promise.resolve(
        connection.isConnected ? connection : connection.connect(),
      );
    } else {
      //@TODO If public, use different entities
      // @TODO Do try-catch
      // @TODO Check db for tenant name. If not exists, create new
      const dbEntities = tenantName == "public" ? [Tenant] : appEntities;
      await createConnection({
        ...config.database,
        name: connectionName,
        type: "postgres",
        entities: dbEntities,
        schema: tenantName,
      });

      const connection = await connectionManager.get(connectionName);
      return Promise.resolve(
        connection.isConnected ? connection : connection.connect(),
      );
    }
  }

  getConnectionName(tenantName: string) {
    return `projectzoe_${tenantName}`;
  }

  async createTenant(tenantData: TenantDto) {
    const connection = await this.getConnection();
    // @TODO Validate tenantData.name, then strip and trim it
    await connection.query(`CREATE SCHEMA IF NOT EXISTS ${tenantData.name}`);
    return await connection.getRepository(Tenant).save(tenantData);
  }
}
