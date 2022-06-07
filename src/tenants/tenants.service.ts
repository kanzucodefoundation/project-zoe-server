import { Injectable } from "@nestjs/common";
import { DbService } from "src/shared/db.service";
import { Tenant } from "./entities/tenant.entity";
import { TenantDto } from "./dto/tenant.dto";
import { SeedService } from "src/seed/seed.service";

@Injectable()
export class TenantsService {
  constructor(
    private readonly dbService: DbService,
    private readonly seedService: SeedService,
  ) {}

  async create(tenantData: TenantDto): Promise<Tenant> {
    // @TODO Wrap this in try-catch and in a transaction
    // @TODO Validate tenantData.name, then strip and trim it
    const connectionPublic = await this.dbService.getConnection();
    return await connectionPublic
      .getRepository(Tenant)
      .findOne({ name: tenantData.name });
  }

  async seed(tenantData: TenantDto): Promise<string> {
    // @TODO Wrap this in try-catch and in a transaction
    if (tenantData.seed) {
      await this.seedService.createAll();
    }
    return "Successfully seeded the tenant";
  }
}
