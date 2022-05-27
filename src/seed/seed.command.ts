import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { SeedService } from "./seed.service";
import { SeedModule } from "./seed.module";
import { getConnectionManager, createConnection, Connection } from "typeorm";
import * as dotenv from "dotenv";
import config, { appEntities } from "../config";

async function bootstrap() {
  const application = await NestFactory.createApplicationContext(AppModule);

  const command = process.argv[2];
  const tenantName = process.argv[3];

  switch (command) {
    case "seed-all":
      const connectionManager = getConnectionManager();
      const connectionName = `${process.env.DB_DATABASE}_${tenantName}`;
      const connection = await getDbConnection(
        connectionManager,
        connectionName,
      );

      const seedService = application
        .select(SeedModule)
        .get(SeedService, { strict: true });
      await seedService.initializeRepositories(connection);
      await seedService.createRoleAdmin();
      await seedService.createUsers();
      await seedService.createGroupCategories();
      await seedService.createEventCategories();
      await seedService.createGroups();
      await seedService.createGroupCategoryReports();
      break;
    default:
      console.log("Command not found");
      process.exit(1);
  }

  await application.close();
  process.exit(0);
}

async function getDbConnection(connectionManager, connectionName) {
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
}

bootstrap();
