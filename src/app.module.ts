import { Global, HttpModule, Logger, Module } from '@nestjs/common';
import { AuthController } from './auth/auth.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { CrmModule } from './crm/crm.module';
import { GroupsModule } from './groups/groups.module';
import config, { appEntities } from './config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { SeedModule } from './seed/seed.module';
import { SeedService } from './seed/seed.service';
import { VendorModule } from './vendor/vendor.module';
import { EventsModule } from './events/events.module';
import { ChatModule } from './chat/chat.module';

@Global()
@Module({
  imports: [
    HttpModule,

    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
    }),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      ...config.database,
      entities: appEntities,
    }),
    UsersModule,
    AuthModule,
    CrmModule,
    GroupsModule,
    SeedModule,
    VendorModule,
    EventsModule,
    ChatModule,
  ],
  exports: [AppService],
  controllers: [AuthController],
  providers: [AppService],
})
export class AppModule {
  constructor(private readonly seedService: SeedService) {}

  async onModuleInit(): Promise<void> {
    Logger.log('#########Initializing application############');
    await this.seedService.createRoleAdmin();
    await this.seedService.createUsers();
    await this.seedService.createGroupCategories();
    await this.seedService.createEventCategories();
    await this.seedService.createGroups();
    await this.seedService.createGroupCategoryReports();
    Logger.log('#########Initialization complete############');
  }
}
