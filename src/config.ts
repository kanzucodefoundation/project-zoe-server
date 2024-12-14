import { TypeOrmModuleOptions } from "@nestjs/typeorm";
import { usersEntities } from "./users/users.helpers";
import { crmEntities } from "./crm/crm.helpers";
import { groupEntities } from "./groups/groups.helpers";
import { eventEntities } from "./events/events.helpers";
import { helpEntities } from "./help/help.helpers";
import { reportsEntities } from "./reports/reports.helpers";
import { botEntities } from "./bot/bot.helpers";

require("dotenv").config();

export function normalizePort(val: any) {
  const port = parseInt(val, 10);
  if (isNaN(port)) {
    // named pipe
    return val;
  }
  if (port >= 0) {
    // port number
    return port;
  }
  return false;
}

const database: TypeOrmModuleOptions = {
  type: "postgres",
  host: process.env.DB_HOST,
  port: normalizePort(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_PORT === "25060" ? true : false,
  database: process.env.DB_DATABASE,
  synchronize: process.env.DB_SYNCHRONIZE === "true",
  cache: true,
  logging: process.env.DB_LOGGING === "true",
};

const config = {
  app: {
    port: normalizePort(process.env.PORT),
  },
  database: database,
};

export default config;

export const appEntities: any[] = [
  ...usersEntities,
  ...crmEntities,
  ...groupEntities,
  ...eventEntities,
  ...reportsEntities,
  ...helpEntities,
  ...botEntities,
];
console.log("#################appEntities#########", appEntities);
