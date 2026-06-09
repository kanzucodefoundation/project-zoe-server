import { forwardRef, Module } from '@nestjs/common';
import { SeedService } from './seed.service';
import { ComprehensiveSeedService } from './comprehensive-seed.service';
import { WhmReportsSeedService } from './whm/whm-reports.seed';
import { WhmGroupTreeSeedService } from './whm/whm-group-tree.seed';
import { CrmModule } from '../crm/crm.module';
import { UsersModule } from '../users/users.module';
import { GroupsModule } from '../groups/groups.module';
import { EventsModule } from '../events/events.module';
import { ReportsModule } from '../reports/reports.module';
import { TenantsModule } from '../tenants/tenants.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { groupEntities } from '../groups/groups.helpers';
import { crmEntities } from '../crm/crm.helpers';
import { usersEntities } from '../users/users.helpers';
import { eventEntities } from '../events/events.helpers';

@Module({
  imports: [
    CrmModule,
    UsersModule,
    GroupsModule,
    EventsModule,
    ReportsModule,
    forwardRef(() => TenantsModule),
    TypeOrmModule.forFeature([
      ...usersEntities,
      ...crmEntities,
      ...groupEntities,
      ...eventEntities,
    ]),
  ],
  providers: [
    SeedService,
    ComprehensiveSeedService,
    WhmReportsSeedService,
    WhmGroupTreeSeedService,
  ],
  exports: [
    SeedService,
    ComprehensiveSeedService,
    WhmReportsSeedService,
    WhmGroupTreeSeedService,
  ],
})
export class SeedModule {}
