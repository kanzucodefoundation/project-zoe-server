import { createConnection, getConnectionManager, Connection } from "typeorm";
import config, { appEntities } from "src/config";
import { Tenant } from "src/tenants/entities/tenant.entity";

/**
 * Synchronize schemas. The public schema only has the tenant entity
 */
async function syncSchemas() {
  try {
    const connection = await createConnection({
      ...config.database,
      type: "postgres",
      entities: [Tenant],
      schema: "public",
    });
    const queryRunner = connection.createQueryRunner();
    const schemasQuery = await queryRunner.query(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT LIKE 'pg_%' AND schema_name != 'information_schema';",
    );
    const schemas = schemasQuery.map((row: any) => row.schema_name);
    for (const schema of schemas) {
      const connectionManager = getConnectionManager();
      let connection: Connection;
      if (connectionManager.has(schema)) {
        connection = connectionManager.get(schema);
      } else {
        const dbEntities = schema == "public" ? [Tenant] : appEntities;
        connection = await createConnection({
          ...config.database,
          synchronize: true,
          name: schema,
          type: "postgres",
          entities: dbEntities,
          schema,
        });
      }
      console.log(`Synchronizing schema '${schema}'...`);
      await connection.synchronize();
      console.log(`Schema '${schema}' synchronized successfully.`);

      await connection.close();
    }

    await queryRunner.release();
    await connection.close();

    console.log("All schemas synchronized.");
  } catch (error) {
    console.error("Error synchronizing schemas:", error);
    process.exit(1);
  }
}

syncSchemas();
