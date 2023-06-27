import { TypeOrmModuleOptions } from "@nestjs/typeorm";
import config, { appEntities } from "./src/config";

// This file is only used for the migrations
const databaseConfig: TypeOrmModuleOptions = {
  ...config.database,
  entities: appEntities,
  migrationsTableName: "typeorm_migrations",
  migrations: ["src/migrations/*.ts"],
  cli: {
    migrationsDir: "src/migrations",
  },
};

export = databaseConfig;
