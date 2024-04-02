import { ReportSubmissionData } from 'src/reports/entities/report.submission.data.entity'; 
import { ReportSubmission } from 'src/reports/entities/report.submission.entity';
import { createConnection, getConnectionManager, Connection } from "typeorm";
import config, { appEntities } from "src/config";
import { Tenant } from "src/tenants/entities/tenant.entity";

/**
 * In version 0.0.1, the report data stored fields as json on the report
 * entity. The submissions data was also stored as json. These were migrated
 * to separate tables in 0.0.2
 * 
 */
async function runMigrateReports() {
  try {
    const connection = await createConnection({
      ...config.database,
      type: "postgres",
      synchronize: true,
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
        const dbEntities = appEntities;
        connection = await createConnection({
          ...config.database,
          synchronize: true,
          name: schema,
          type: "postgres",
          entities: dbEntities,
          schema,
        });
      }
      console.log(`Migrating report submission data in schema '${schema}'...`);
      await migrateReportSubmissionData(connection);
      await connection.synchronize();
      console.log(`Report submission data in '${schema}' migrated successfully.`);
      await connection.close();
    }

    await queryRunner.release();
    await connection.close();

    console.log("All report submission data migrated.");
  } catch (error) {
    console.error("Error migrating report submission data:", error);
    process.exit(1);
  }
}


async function migrateReportSubmissionData(connection: Connection) {
  // Fetch all submissions. Consider batching if there are many submissions.
  const submissions = await connection.manager.find(ReportSubmission, {
    relations: ["report", "report.fields"],
  });

  for (const submission of submissions) {
    // Assuming the old 'data' JSONB column contains key-value pairs corresponding to report fields
    for (const [key, value] of Object.entries(submission.data || {})) {
      // Find the corresponding ReportField based on the key (name)
      const reportField = submission.report.fields.find(field => field.name === key);

      if (!reportField) {
        console.warn(`No matching ReportField found for key: ${key} in submission: ${submission.id}`);
        continue; // Skip this key-value pair if no matching field is found
      }

      // Create a new ReportSubmissionData entity for this key-value pair
      const submissionData = new ReportSubmissionData();
      submissionData.reportSubmission = submission;
      submissionData.reportField = reportField;
      submissionData.fieldValue = typeof value === 'string' ? value : JSON.stringify(value); // Ensure the value is stored as a string

      // Save the new ReportSubmissionData entity
      await connection.manager.save(submissionData);
    }

    // Optionally clear the old 'data' JSONB column to signify migration completion
    // submission.data = {}; // Clear the old data if it's safe to do so
    await connection.manager.save(submission);
  }
}

runMigrateReports();


