import { Module, Scope, Global, BadRequestException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import * as dotenv from 'dotenv';
import { DbService } from 'src/shared/db.service';
import { SeedModule } from 'src/seed/seed.module';
import { Tenant } from './entities/tenant.entity';

const connectionFactory = {
  provide: 'CONNECTION',
  scope: Scope.REQUEST,
  useFactory: async (req: any, dbservice: DbService) => {
    const tenantName = req.headers['tenant'];
    const connectionPublic = await dbservice.getConnection();
    const isCreatingNewTenant =
      req.originalUrl == '/api/tenants' && req.method == 'POST';
    let tenantDetails: Tenant;

    if (isCreatingNewTenant) {
      // @TODO Move this
      tenantDetails = await dbservice.createTenant({ name: tenantName });
    } else {
      tenantDetails = await connectionPublic
        .getRepository(Tenant)
        .findOne({ name: tenantName });
    }

    if (!tenantName) {
      throw new BadRequestException(
        'No church name provided. A valid church name must be provided.',
      );
    }

    if (!tenantDetails) {
      throw new BadRequestException('Invalid church name provided.');
    }

    return dbservice.getConnection(tenantName);
  },
  inject: [REQUEST, DbService],
};

@Global()
@Module({
  imports: [SeedModule],
  providers: [connectionFactory, TenantsService, DbService],
  exports: ['CONNECTION'],
  controllers: [TenantsController],
})
export class TenantsModule {}
