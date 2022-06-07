import { Injectable } from "@nestjs/common";
import { DbService } from "src/shared/db.service";
import { Tenant } from "./entities/tenant.entity";
import { TenantDto } from "./dto/tenant.dto";
import { SeedService } from "src/seed/seed.service";
import { lowerCaseRemoveSpaces } from "src/utils/stringHelpers";

@Injectable()
export class TenantsService {
  constructor(
    private readonly dbService: DbService,
    private readonly seedService: SeedService,
  ) {}

  async create(tenantData: TenantDto): Promise<Tenant> {
    // The creation is done in the middleware
    const tenantName = lowerCaseRemoveSpaces(tenantData.name);
    const connectionPublic = await this.dbService.getConnection();
    return await connectionPublic
      .getRepository(Tenant)
      .findOne({ name: tenantName });
  }

  async seed(tenantData: TenantDto): Promise<string> {
    if (tenantData.seed) {
      await this.seedService.createAll();
    }
    return "Successfully seeded the tenant";
  }
}
