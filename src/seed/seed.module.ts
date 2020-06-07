import { Module } from '@nestjs/common';
import { SeedService } from './seed.service';
import { CrmModule } from '../crm/crm.module';
import { ServicesModule } from '../services/services.module';
import { UsersModule } from '../users/users.module';
import { GroupsModule } from '../groups/groups.module';
import { AppointmentModule } from '../appointment/appointments.module';

@Module({
  imports: [CrmModule, AppointmentModule, ServicesModule, UsersModule,GroupsModule],
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedModule {

}
