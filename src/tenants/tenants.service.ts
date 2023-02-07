import { Injectable, Logger } from "@nestjs/common";
import { DbService } from "src/shared/db.service";
import { Tenant } from "./entities/tenant.entity";
import { TenantDto } from "./dto/tenant.dto";
import { SeedService } from "src/seed/seed.service";
import { lowerCaseRemoveSpaces } from "src/utils/stringHelpers";
import { Connection } from "typeorm";
import { JwtHelperService } from "src/auth/jwt-helpers.service";
import { ContactsService } from "src/crm/contacts.service";
import { GoogleService } from "src/vendor/google.service";
import { PrismaService } from "src/shared/prisma.service";
import { GroupFinderService } from "src/crm/group-finder/group-finder.service";
import { AddressesService } from "src/crm/addresses.service";
import { GroupCategoriesService } from "src/groups/services/group-categories.service";
import { GroupPermissionsService } from "src/groups/services/group-permissions.service";

@Injectable()
export class TenantsService {
  async create(
    tenantData: TenantDto,
    dbService: DbService,
    seedService: SeedService,
    googleService: GoogleService,
    jwtHelperService: JwtHelperService,
    prisma: PrismaService,
    groupFinderService: GroupFinderService,
    addressesService: AddressesService,
    groupsPermissionsService: GroupPermissionsService,
  ): Promise<Tenant> {
    const tenantName = lowerCaseRemoveSpaces(tenantData.name);
    const tenantDetails = await dbService.createTenant({ name: tenantName });
    const connection: Connection = await dbService.getConnection(tenantName);
    const groupCategoriesService = new GroupCategoriesService(connection);
    const contactService: ContactsService = new ContactsService(
      connection,
      googleService,
      prisma,
      groupFinderService,
      addressesService,
    );
    await seedService.createAll(
      connection,
      contactService,
      jwtHelperService,
      groupsPermissionsService,
      groupCategoriesService,
      googleService,
    );
    return tenantDetails;
  }
}
