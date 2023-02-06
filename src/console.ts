import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { TenantDto } from "./tenants/dto/tenant.dto";
import { TenantsService } from "./tenants/tenants.service";
import { DbService } from "./shared/db.service";
import { SeedService } from "./seed/seed.service";
import { UsersService } from "./users/users.service";
async function bootstrap() {
  const application = await NestFactory.createApplicationContext(AppModule);

  const command = process.argv[2];
  const tenantName = process.argv[3];
  const seedTenant = process.argv[4];

  switch (command) {
    case "create-tenant":
      const tenantsService = application.get(TenantsService);
      const dbService = application.get(DbService);
      const seedService = application.get(SeedService);
      const usersService = application.get(UsersService);
      const tenantDto: TenantDto = { name: tenantName };
      await tenantsService.create(
        tenantDto,
        dbService,
        seedService,
        usersService,
      );
      break;
    default:
      console.log("Command not found");
      process.exit(1);
  }

  await application.close();
  process.exit(0);
}

bootstrap();
