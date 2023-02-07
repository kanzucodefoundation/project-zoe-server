import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { TenantDto } from "./tenants/dto/tenant.dto";
import { TenantsService } from "./tenants/tenants.service";
import { DbService } from "./shared/db.service";
import { SeedService } from "./seed/seed.service";
import { UsersService } from "./users/users.service";
import { SeedModule } from "./seed/seed.module";
import { Connection } from "typeorm";
import { TenantsModule } from "./tenants/tenants.module";
import { ContactsService } from "./crm/contacts.service";
import { JwtHelperService } from "./auth/jwt-helpers.service";
import { CrmModule } from "./crm/crm.module";
import { GoogleService } from "./vendor/google.service";
import { PrismaService } from "./shared/prisma.service";
import { GroupFinderService } from "./crm/group-finder/group-finder.service";
import { AddressesService } from "./crm/addresses.service";
import { GroupsService } from "./groups/services/groups.service";
import { GroupCategoriesService } from "./groups/services/group-categories.service";
import { GroupPermissionsService } from "./groups/services/group-permissions.service";

async function bootstrap() {
  const application = await NestFactory.createApplicationContext(AppModule);

  const command = process.argv[2];
  const tenantName = process.argv[3];

  switch (command) {
    case "create-tenant":
      const tenantsService = application.get(TenantsService);
      const dbService = application.get(DbService);
      const seedService = application.get(SeedService);
      const jwtHelperService = application.get(JwtHelperService);
      const googleService = application.get(GoogleService);
      const prismaService = application.get(PrismaService);
      const groupFinderService = application.get(GroupFinderService);
      const addressesService = application.get(AddressesService);
      const groupsPermissionsService = application.get(GroupPermissionsService);

      const tenantDto: TenantDto = { name: tenantName };
      await tenantsService.create(
        tenantDto,
        dbService,
        seedService,
        googleService,
        jwtHelperService,
        prismaService,
        groupFinderService,
        addressesService,
        groupsPermissionsService,
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
