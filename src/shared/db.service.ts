import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import { Tenant } from 'src/tenants/entities/tenant.entity';
import { TenantDto } from 'src/tenants/dto/tenant.dto';

/**
 * DbService - Simplified for row-level multi-tenancy
 *
 * No longer manages schema-based connections.
 * Uses a single connection to the public schema with row-level tenancy.
 */
@Injectable()
export class DbService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  /**
   * Get the default database connection (public schema)
   * This method is kept for backward compatibility but now returns the single connection
   */
  async getConnection(): Promise<Connection> {
    return this.connection;
  }

  /**
   * Create a new tenant (row-level tenancy)
   * No longer creates separate schemas
   */
  async createTenant(tenantData: TenantDto): Promise<Tenant> {
    Logger.log(`Creating tenant: ${tenantData.name}`);
    return await this.connection.getRepository(Tenant).save(tenantData);
  }

  /**
   * Get tenant by name
   */
  async getTenantByName(name: string): Promise<Tenant | null> {
    return await this.connection.getRepository(Tenant).findOne({
      where: { name },
    });
  }

  /**
   * Get tenant by ID
   */
  async getTenantById(id: number): Promise<Tenant | null> {
    return await this.connection.getRepository(Tenant).findOne({
      where: { id },
    });
  }
}
