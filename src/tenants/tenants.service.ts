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
    const connection = await this.dbService.getConnection();
    // @TODO Validate tenantData.name, then strip and trim it
    await connection.query(`CREATE SCHEMA IF NOT EXISTS ${tenantData.name}`);
    if (tenantData.seed) {
      await this.seedService.createAll();
    }
    return await connection.getRepository(Tenant).save(tenantData);
  }
}
