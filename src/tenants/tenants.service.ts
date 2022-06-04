import { Injectable } from "@nestjs/common";
import { DbService } from "src/shared/db.service";
import { Tenant } from "./entities/tenant.entity";
import { TenantDto } from "./dto/tenant.dto";
@Injectable()
export class TenantsService {
  constructor(private readonly dbService: DbService) {}

  async create(tenantData: TenantDto): Promise<Tenant> {
    const connection = await this.dbService.getConnection();
    // @TODO Check if schema exists. If not, create it
    return await connection.getRepository(Tenant).save(tenantData);
  }
}
