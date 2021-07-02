import { Global, HttpModule, Logger, Module } from '@nestjs/common';

import AdminJS from 'adminjs';
import { Database, Resource } from '@adminjs/typeorm';
import { validate } from 'class-validator';

import { AuthController } from './auth/auth.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { ConfigModule } from '@nestjs/config';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
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
import { AdminModule } from '@adminjs/nestjs';
import { Connection } from 'typeorm';
import { User } from './users/user.entity';
import { AuthService } from './auth/auth.service';
import { UsersService } from './users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ContactsService } from './crm/contacts.service';

AdminJS.registerAdapter({ Database, Resource });
Resource.validate = validate;

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
    AdminModule.createAdmin({
      adminJsOptions: {
        rootPath: '/admin',
        resources: [...appEntities],
      },
      auth: {
        authenticate: async (email, password) =>
          Promise.resolve({ email: 'test' }),
        cookieName: 'auth-cookie',
        cookiePassword: 'auth-cookie',
      },
    }),
    AdminModule.createAdminAsync({
      imports: [TypeOrmModule.forFeature([User]), UsersModule, CrmModule],
      inject: [Connection, getRepositoryToken(User)],
      useFactory: (authService: AuthService) => ({
        adminJsOptions: {
          rootPath: '/admin',
          resources: [...appEntities],
        },
        auth: {
          authenticate: async (email, password) => {
            const {
              fullName,
              id,
              isActive,
              roles,
            } = await authService.validateUser(email, password);

            return {
              id: String(id),
              email,
              title: fullName,
            };
          },
          cookieName: 'auth-cookie',
          cookiePassword: 'auth-cookie',
        },
      }),
    }),
  ],
  exports: [AppService],
  controllers: [AuthController],
  providers: [AppService],
})
export class AppModule {
  constructor(private readonly seedService: SeedService) {}

  async onModuleInit(): Promise<void> {
    Logger.log('#########Initializing application############');
    await this.seedService.createUsers();
    await this.seedService.createGroupCategories();
    await this.seedService.createEventCategories();
    await this.seedService.createGroups();
    await this.seedService.createGroupCategoryReports();
    Logger.log('#########Initialization complete############');
  }
}
