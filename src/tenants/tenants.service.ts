import { Injectable } from "@nestjs/common";
import { DbService } from "src/shared/db.service";
import { Tenant } from "./entities/tenant.entity";
@Injectable()
export class TenantsService {
  constructor(private readonly dbService: DbService) {}

  async create(tenantData: Tenant): Promise<Tenant> {
    const connection = this.dbService.getConnection();
    return await connection.getRepository(Tenant).save(tenantData);
  }
}
