import { Logger, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { CrmModule } from './crm/crm.module';
import { ServicesModule } from './services/services.module';
import { GroupsModule } from './groups/groups.module';
import config from './config';
import { Appointment } from './appointment/entities/appointment.entity';
import { AppointmentModule } from './appointment/appointments.module';
import { groupEntities } from './groups/groups.helpers';
import { crmEntities } from './crm/crm.helpers';
import { usersEntities } from './users/users.helpers';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { SeedModule } from './seed/seed.module';
import { SeedService } from './seed/seed.service';
import { TasksModule } from './tasks/tasks.module';
import { tasksEntities } from './tasks/tasks.helpers';
import { UserTaskModule } from './user_tasks/user_task.module';
import { AppointmentTaskModule } from'./appointment_tasks/appointment_task.module';
import { AppointmentTask } from './appointment_tasks/entities/appointment_task.entity';
import { UserTask } from './user_tasks/entities/user_task.entity';
import { BlockedDate } from './blocked_dates/entities/blocked_date.entity';
import { BlockedDateModule } from './blocked_dates/blocked_date.module';

console.log('Database', config.database);
@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
    }),
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'mysql',
      ...config.database,
      entities: [
        ...usersEntities,
        ...tasksEntities,
        Appointment,
        AppointmentTask,
        UserTask,
        BlockedDate,
        ...crmEntities,
        ...groupEntities,
      ],
      logging: true,
    }),
    UsersModule,
    AuthModule,
    CrmModule,
    ServicesModule,
    GroupsModule,
    SeedModule,
    TasksModule,
    AppointmentModule,
    AppointmentTaskModule,
    UserTaskModule,
    BlockedDateModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  constructor(private readonly seedService: SeedService) {}

  async onModuleInit(): Promise<void> {
    Logger.log('#########Initialized application############');
    await this.seedService.createUsers();
    await this.seedService.createGroupCategories();
    await this.seedService.createGroups();
    Logger.log('#########Initialization complete############');
  }
}
