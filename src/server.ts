#!/usr/bin/env nodejs
require("dotenv").config();
import app from "./app";
import {normalizePort} from "./utils/numberHelper";
import "reflect-metadata";
import {createConnection} from "typeorm";
import logger from "./utils/logging/logger";
import {User} from "./modules/security/users/user.entity";
import {UserGroup} from "./modules/security/usergroup/usergroup.entity";
import {crmEntities} from "./modules/crm/entities";
import {seedDataAsync} from "./data/seed";
import {groupEntities} from "./modules/groups";
import {Tag} from "./modules/tags/Tag";

logger.info("Creating connection");

const host: string = process.env.DB_HOST || "localhost";
const username: string = process.env.DB_USERNAME || "localhost";
const password: string = process.env.DB_PASSWORD || "root";
const database: string = process.env.DB_DATABASE || "node-test";
const dbPort: number = normalizePort(process.env.DB_PORT || "3006");
console.log(`Paa____${password}___`);
createConnection({
    type: "mysql",
    host,
    port: dbPort,
    username,
    password,
    database,
    entities: [
        ...crmEntities, ...groupEntities,
        User, UserGroup, Tag
    ],
    synchronize: true,
    logging: true
}).then(async connection => {
    logger.info(`SQL Server connected ${connection.isConnected}`);
    await seedDataAsync();
    const port = normalizePort(process.env.PORT || "3004");
    app.set("port", port);
    app.listen(port, () => {
        logger.info("Express server listening on port " + port);
    });
}).catch(error => console.log(error));

