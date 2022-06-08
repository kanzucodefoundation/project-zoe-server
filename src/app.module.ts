import {
  Global,
  HttpModule,
  Logger,
  Module,
  MiddlewareConsumer,
} from '@nestjs/common';
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
import { HelpModule } from './help/help.module';
import { TenantsModule } from './tenants/tenants.module';
import { JwtTenantHeaderMiddleware } from './middleware/jwtTenantHeader.middleware';
import { nameTenantHeaderMiddleware } from './middleware/nameTenantHeader.middleware';

@Global()
@Module({
  imports: [
    HttpModule,

    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
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
    HelpModule,
    TenantsModule,
  ],
  exports: [AppService],
  controllers: [AuthController],
  providers: [AppService],
})
export class AppModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(JwtTenantHeaderMiddleware)
      .exclude(
        'api/tenants',
        'api/tenants/seed',
        'api/auth/login',
        'api/auth/forgot-password',
        'api/auth/reset-password/:token',
        'api/register',
        'api/groups/combo',
      )
      .forRoutes('*');

    consumer
      .apply(nameTenantHeaderMiddleware)
      .forRoutes(
        'api/tenants',
        'api/tenants/seed',
        'api/auth/login',
        'api/auth/forgot-password',
        'api/auth/reset-password/:token',
        'api/register',
        'api/groups/combo',
      );
  }
}
