import app from "./app";
import {normalizePort} from "./utils/numberHelper";

import "reflect-metadata";
import {createConnection} from "typeorm";
import logger from "./utils/logging/logger";
import {User} from "./modules/security/users/user.entity";
import {UserGroup} from "./modules/security/usergroup/usergroup.entity";
import {crmEntities} from "./modules/crm/entities";


createConnection({
    type: "mysql",
    host: "localhost",
    port: 3306,
    username: "root",
    password: "root",
    database: "node-test",
    entities: [
        ...crmEntities,
        User, UserGroup,
    ],
    synchronize: true,
    logging: false
}).then(async connection => {
    logger.info(`SQL Server connected ${connection.isConnected}`)
    const port = normalizePort(process.env.PORT || '3004');
    app.set('port', port);
    app.listen(port, () => {
        logger.info('Express server listening on port ' + port);
    });
}).catch(error => console.log(error));

