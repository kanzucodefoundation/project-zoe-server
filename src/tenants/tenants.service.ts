import { Injectable, Logger } from "@nestjs/common";
import { DbService } from "src/shared/db.service";
import { Tenant } from "./entities/tenant.entity";
import { TenantDto } from "./dto/tenant.dto";
import { SeedService } from "src/seed/seed.service";
import { lowerCaseRemoveSpaces } from "src/utils/stringHelpers";
import { Db } from "typeorm";
import { Connection } from "typeorm";
import { UsersService } from "src/users/users.service";

@Injectable()
export class TenantsService {
  async create(
    tenantData: TenantDto,
    dbService: DbService,
    seedService: SeedService,
    usersService: UsersService,
  ): Promise<Tenant> {
    const tenantName = lowerCaseRemoveSpaces(tenantData.name);
    const tenantDetails = await dbService.createTenant({ name: tenantName });
    const connection: Connection = await dbService.getConnection(tenantName);
    await seedService.createAll(connection, usersService);
    return tenantDetails;
  }
}
