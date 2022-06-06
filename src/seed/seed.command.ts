import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { SeedService } from "./seed.service";

async function bootstrap() {
  const application = await NestFactory.createApplicationContext(AppModule);

  const command = process.argv[2];

  switch (command) {
    case "seed-all":
      const seedService = application.get(SeedService);
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

bootstrap();
